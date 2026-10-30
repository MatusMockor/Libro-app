import { Inject, Injectable } from '@nestjs/common';
import {
  MAX_MEDIA_PER_CALL,
  MEDIA_LIBRARY,
  MediaNotFoundException,
  type MediaLibrary,
  type MediaWithUrls,
} from '../../media/index.js';
import { idChunks } from '../../../shared/id-batch.js';

@Injectable()
export class PostPhotosService {
  constructor(@Inject(MEDIA_LIBRARY) private readonly media: MediaLibrary) {}

  async ensureOwned(authorId: string, mediaIds: readonly string[]): Promise<void> {
    const found = await Promise.all(
      mediaIds.map((mediaId) => this.media.findOwned(authorId, mediaId)),
    );
    const missing = mediaIds.find((_, index) => found[index] === undefined);
    if (missing !== undefined) {
      throw new MediaNotFoundException(missing);
    }
  }

  async findAll(mediaIds: readonly string[]): Promise<ReadonlyMap<string, MediaWithUrls>> {
    const found = new Map<string, MediaWithUrls>();
    for (const chunk of idChunks(mediaIds, MAX_MEDIA_PER_CALL)) {
      for (const [mediaId, media] of await this.media.findMany(chunk)) {
        found.set(mediaId, media);
      }
    }

    return found;
  }
}
