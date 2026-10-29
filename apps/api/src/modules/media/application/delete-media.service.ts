import { Inject, Injectable } from '@nestjs/common';
import { MediaFileDeletionService } from './media-file-deletion.service.js';
import { MediaNotFoundException } from './media-not-found.exception.js';
import { MEDIA_REPOSITORY, type MediaRepository } from './media-repository.js';

@Injectable()
export class DeleteMediaService {
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly media: MediaRepository,
    private readonly fileDeletions: MediaFileDeletionService,
  ) {}

  async delete(ownerId: string, mediaId: string): Promise<void> {
    const storageKeys = await this.media.deleteOwned(ownerId, mediaId);
    if (!storageKeys) {
      throw new MediaNotFoundException(mediaId);
    }

    await this.fileDeletions.afterRowsDeleted(storageKeys);
  }

  async deleteAllOwned(ownerId: string): Promise<void> {
    await this.fileDeletions.afterRowsDeleted(await this.media.deleteAllOwned(ownerId));
  }
}
