import { Inject, Injectable, Logger } from '@nestjs/common';
import type { MediaFileDeletionReport, MediaFileDeletions } from '../media-file-deletions.js';
import { FILE_STORAGE, type FileStorage } from './file-storage.js';
import {
  PENDING_FILE_DELETION_REPOSITORY,
  type FailedFileDeletion,
  type PendingFileDeletionRepository,
} from './pending-file-deletion-repository.js';

const DUE_RETRIES_PER_DELETION = 10;

const PENDING_PER_PAGE = 100;

interface FileDeletionOutcome {
  readonly storageKey: string;
  readonly error: string | undefined;
}

@Injectable()
export class MediaFileDeletionService implements MediaFileDeletions {
  private readonly logger = new Logger(MediaFileDeletionService.name);

  constructor(
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(PENDING_FILE_DELETION_REPOSITORY)
    private readonly pending: PendingFileDeletionRepository,
  ) {}

  async afterRowsDeleted(storageKeys: readonly string[]): Promise<void> {
    try {
      await this.deleteFiles(storageKeys);
      await this.deleteFiles(await this.pending.due(DUE_RETRIES_PER_DELETION, storageKeys));
    } catch (error) {
      this.logger.warn(
        `Could not finish media file deletions, they stay pending: ${reasonOf(error)}`,
      );
    }
  }

  async retryPending(): Promise<MediaFileDeletionReport> {
    let report: MediaFileDeletionReport = { deleted: 0, failed: 0 };
    let afterKey: string | undefined;

    for (;;) {
      const storageKeys = await this.pending.page({ afterKey, limit: PENDING_PER_PAGE });
      const outcome = await this.deleteFiles(storageKeys);
      report = {
        deleted: report.deleted + outcome.deleted,
        failed: report.failed + outcome.failed,
      };

      afterKey = storageKeys.at(-1);
      if (storageKeys.length < PENDING_PER_PAGE) {
        return report;
      }
    }
  }

  private async deleteFiles(storageKeys: readonly string[]): Promise<MediaFileDeletionReport> {
    const outcomes = await Promise.all(storageKeys.map((key) => this.deleteFile(key)));
    const failures = outcomes.filter(isFailure);
    const deleted = outcomes
      .filter(({ error }) => error === undefined)
      .map(({ storageKey }) => storageKey);

    await this.pending.complete(deleted);
    await this.pending.fail(failures);
    failures.forEach(({ storageKey, error }) => {
      this.logger.warn(`Could not delete media file ${storageKey}, it stays pending: ${error}`);
    });

    return { deleted: deleted.length, failed: failures.length };
  }

  private async deleteFile(storageKey: string): Promise<FileDeletionOutcome> {
    try {
      await this.storage.delete(storageKey);
      return { storageKey, error: undefined };
    } catch (error) {
      return { storageKey, error: reasonOf(error) };
    }
  }
}

function isFailure(outcome: FileDeletionOutcome): outcome is FailedFileDeletion {
  return outcome.error !== undefined;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
