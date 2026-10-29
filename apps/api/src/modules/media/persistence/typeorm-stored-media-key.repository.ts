import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { StoredMediaKeys } from '../application/stored-media-keys.js';
import { MediaFileVariantEntity } from './media-file-variant.entity.js';

const SELECT_STORED = `
  SELECT EXISTS (SELECT 1 FROM media.file_variants WHERE storage_key = $1) AS stored
`;

@Injectable()
export class TypeOrmStoredMediaKeyRepository implements StoredMediaKeys {
  constructor(
    @InjectRepository(MediaFileVariantEntity)
    private readonly variants: Repository<MediaFileVariantEntity>,
  ) {}

  async isStored(storageKey: string): Promise<boolean> {
    const [row] = await this.variants.query<[{ stored: boolean }]>(SELECT_STORED, [storageKey]);

    return row.stored;
  }
}
