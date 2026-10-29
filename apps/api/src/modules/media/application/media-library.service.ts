import { Inject, Injectable } from '@nestjs/common';
import type { MediaWithUrls } from '../domain/media.js';
import type { MediaLibrary } from '../media-library.js';
import { MediaNotFoundException } from './media-not-found.exception.js';
import { MEDIA_REPOSITORY, type MediaRepository } from './media-repository.js';
import { MediaUrlsService } from './media-urls.service.js';

@Injectable()
export class MediaLibraryService implements MediaLibrary {
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly media: MediaRepository,
    private readonly urls: MediaUrlsService,
  ) {}

  async findOwned(userId: string, mediaId: string): Promise<MediaWithUrls | undefined> {
    const media = await this.media.findOwned(userId, mediaId);

    return media ? this.urls.withUrls(media) : undefined;
  }

  async getOwned(userId: string, mediaId: string): Promise<MediaWithUrls> {
    const media = await this.findOwned(userId, mediaId);
    if (!media) {
      throw new MediaNotFoundException(mediaId);
    }

    return media;
  }
}
