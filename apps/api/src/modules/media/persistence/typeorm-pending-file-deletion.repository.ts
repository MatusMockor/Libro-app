import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  FailedFileDeletion,
  PendingFileDeletionPage,
  PendingFileDeletionRepository,
} from '../application/pending-file-deletion-repository.js';
import { PendingFileDeletionEntity } from './pending-file-deletion.entity.js';

const ERROR_MAX_LENGTH = 1000;

const SELECT_PAGE = `
  SELECT storage_key AS "storageKey"
  FROM media.pending_file_deletions
  WHERE $1::text IS NULL OR storage_key > $1::text
  ORDER BY storage_key
  LIMIT $2
`;

const SELECT_DUE = `
  SELECT storage_key AS "storageKey"
  FROM media.pending_file_deletions
  WHERE storage_key <> ALL ($2::text[])
  ORDER BY attempts, created_at, storage_key
  LIMIT $1
`;

const DELETE_COMPLETED = `
  DELETE FROM media.pending_file_deletions WHERE storage_key = ANY ($1::text[])
`;

const RECORD_FAILURES = `
  UPDATE media.pending_file_deletions AS pending
  SET attempts = pending.attempts + 1, last_error = left(failure.error, $3::int)
  FROM unnest($1::text[], $2::text[]) AS failure (storage_key, error)
  WHERE pending.storage_key = failure.storage_key
`;

@Injectable()
export class TypeOrmPendingFileDeletionRepository implements PendingFileDeletionRepository {
  constructor(
    @InjectRepository(PendingFileDeletionEntity)
    private readonly pending: Repository<PendingFileDeletionEntity>,
  ) {}

  async page({ afterKey, limit }: PendingFileDeletionPage): Promise<string[]> {
    return storageKeysOf(
      await this.pending.query<{ storageKey: string }[]>(SELECT_PAGE, [afterKey ?? null, limit]),
    );
  }

  async due(limit: number, excluding: readonly string[]): Promise<string[]> {
    return storageKeysOf(
      await this.pending.query<{ storageKey: string }[]>(SELECT_DUE, [limit, excluding]),
    );
  }

  async complete(storageKeys: readonly string[]): Promise<void> {
    if (storageKeys.length === 0) {
      return;
    }

    await this.pending.query(DELETE_COMPLETED, [storageKeys]);
  }

  async fail(failures: readonly FailedFileDeletion[]): Promise<void> {
    if (failures.length === 0) {
      return;
    }

    await this.pending.query(RECORD_FAILURES, [
      failures.map(({ storageKey }) => storageKey),
      failures.map(({ error }) => error),
      ERROR_MAX_LENGTH,
    ]);
  }
}

function storageKeysOf(rows: readonly { storageKey: string }[]): string[] {
  return rows.map(({ storageKey }) => storageKey);
}
