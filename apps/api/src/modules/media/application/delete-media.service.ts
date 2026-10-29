import { Inject, Injectable } from '@nestjs/common';
import { MediaFileCleanupService } from './media-file-cleanup.service.js';
import { MediaNotFoundException } from './media-not-found.exception.js';
import { MEDIA_REPOSITORY, type MediaRepository } from './media-repository.js';

@Injectable()
export class DeleteMediaService {
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly media: MediaRepository,
    private readonly cleanup: MediaFileCleanupService,
  ) {}

  async delete(ownerId: string, mediaId: string): Promise<void> {
    const storageKeys = await this.media.deleteOwned(ownerId, mediaId);
    if (!storageKeys) {
      throw new MediaNotFoundException(mediaId);
    }

    await this.cleanup.removeQuietly(storageKeys);
  }
}
