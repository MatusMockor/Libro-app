import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaLimitReachedException } from '../application/media-limit-reached.exception.js';
import type { MediaRepository } from '../application/media-repository.js';
import type { MediaVariant, NewMedia, StoredMedia } from '../domain/media.js';
import { MediaFileEntity } from './media-file.entity.js';

const COUNT_OWNED = `
  SELECT count(*)::int AS owned FROM media.files WHERE owner_id = $1
`;

const LOCK_OWNER = `
  SELECT pg_advisory_xact_lock(hashtextextended('media.files/' || $1::text, 0))
`;

const INSERT_FILE_BELOW_LIMIT = `
  INSERT INTO media.files (id, owner_id, width, height)
  SELECT $1::uuid, $2::uuid, $3::int, $4::int
  WHERE (SELECT count(*) FROM media.files WHERE owner_id = $2) < $5
  RETURNING created_at AS "createdAt"
`;

const INSERT_VARIANTS = `
  INSERT INTO media.file_variants (file_id, name, storage_key, width, height, byte_size)
  SELECT $1::uuid, variant.name, variant.storage_key, variant.width, variant.height, variant.byte_size
  FROM unnest($2::text[], $3::text[], $4::int[], $5::int[], $6::int[])
    AS variant (name, storage_key, width, height, byte_size)
`;

const SELECT_MEDIA = `
  SELECT file.id,
         file.owner_id AS "ownerId",
         file.width,
         file.height,
         file.created_at AS "createdAt",
         json_agg(
           json_build_object(
             'name', variant.name,
             'storageKey', variant.storage_key,
             'width', variant.width,
             'height', variant.height,
             'byteSize', variant.byte_size
           )
           ORDER BY variant.name
         ) AS variants
  FROM media.files AS file
  JOIN media.file_variants AS variant ON variant.file_id = file.id
`;

const SELECT_OWNED = `${SELECT_MEDIA}
  WHERE file.owner_id = $1 AND file.id = $2
  GROUP BY file.id
`;

const SELECT_MANY = `${SELECT_MEDIA}
  WHERE file.id = ANY ($1::uuid[])
  GROUP BY file.id
`;

const DELETE_OWNED_VARIANTS = `
  DELETE FROM media.file_variants AS variant
  USING media.files AS file
  WHERE variant.file_id = file.id AND file.owner_id = $1 AND file.id = $2
  RETURNING variant.storage_key AS "storageKey"
`;

const DELETE_OWNED_FILE = `
  DELETE FROM media.files WHERE owner_id = $1 AND id = $2 RETURNING id
`;

@Injectable()
export class TypeOrmMediaRepository implements MediaRepository {
  constructor(
    @InjectRepository(MediaFileEntity) private readonly files: Repository<MediaFileEntity>,
  ) {}

  async countOwned(ownerId: string): Promise<number> {
    const [row] = await this.files.query<[{ owned: number }]>(COUNT_OWNED, [ownerId]);

    return row.owned;
  }

  add(media: NewMedia, limit: number): Promise<StoredMedia> {
    const { id, ownerId, width, height, variants } = media;

    return this.files.manager.transaction(async (manager) => {
      await manager.query(LOCK_OWNER, [ownerId]);
      const [file] = await manager.query<{ createdAt: Date }[]>(INSERT_FILE_BELOW_LIMIT, [
        id,
        ownerId,
        width,
        height,
        limit,
      ]);
      if (!file) {
        throw new MediaLimitReachedException(limit);
      }

      await manager.query(INSERT_VARIANTS, [id, ...variantColumns(variants)]);

      return { ...media, createdAt: file.createdAt };
    });
  }

  async findOwned(ownerId: string, mediaId: string): Promise<StoredMedia | undefined> {
    const [media] = await this.files.query<StoredMedia[]>(SELECT_OWNED, [ownerId, mediaId]);

    return media;
  }

  findMany(mediaIds: readonly string[]): Promise<StoredMedia[]> {
    return this.files.query<StoredMedia[]>(SELECT_MANY, [mediaIds]);
  }

  deleteOwned(ownerId: string, mediaId: string): Promise<readonly string[] | undefined> {
    return this.files.manager.transaction(async (manager) => {
      const [variants] = await manager.query<DeleteResult<{ storageKey: string }>>(
        DELETE_OWNED_VARIANTS,
        [ownerId, mediaId],
      );
      const [, deleted] = await manager.query<DeleteResult<{ id: string }>>(DELETE_OWNED_FILE, [
        ownerId,
        mediaId,
      ]);

      return deleted === 1 ? variants.map(({ storageKey }) => storageKey) : undefined;
    });
  }
}

type DeleteResult<TRow> = [TRow[], number];

function variantColumns(variants: readonly MediaVariant[]): unknown[][] {
  return [
    variants.map(({ name }) => name),
    variants.map(({ storageKey }) => storageKey),
    variants.map(({ width }) => width),
    variants.map(({ height }) => height),
    variants.map(({ byteSize }) => byteSize),
  ];
}
