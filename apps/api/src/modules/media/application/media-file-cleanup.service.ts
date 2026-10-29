import { Inject, Injectable, Logger } from '@nestjs/common';
import { FILE_STORAGE, type FileStorage } from './file-storage.js';

@Injectable()
export class MediaFileCleanupService {
  private readonly logger = new Logger(MediaFileCleanupService.name);

  constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}

  async removeQuietly(keys: readonly string[]): Promise<void> {
    const removals = await Promise.allSettled(keys.map((key) => this.storage.delete(key)));

    removals.forEach((removal, index) => {
      if (removal.status === 'rejected') {
        this.logger.warn(
          `Could not delete media file ${String(keys[index])}: ${reasonOf(removal)}`,
        );
      }
    });
  }
}

function reasonOf({ reason }: PromiseRejectedResult): string {
  return reason instanceof Error ? reason.message : String(reason);
}
