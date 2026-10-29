import { Inject, Injectable } from '@nestjs/common';
import type { MediaVariantUrl, MediaWithUrls, StoredMedia } from '../domain/media.js';
import { MEDIA_VARIANT_NAMES, type MediaVariantName } from '../domain/media-variant.js';
import { urlsExpiry } from '../domain/url-expiry.js';
import { FILE_STORAGE, type FileStorage } from './file-storage.js';

@Injectable()
export class MediaUrlsService {
  constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}

  async withUrls({ id, width, height, createdAt, variants }: StoredMedia): Promise<MediaWithUrls> {
    const urlsExpireAt = urlsExpiry(new Date());
    const signed = await Promise.all(
      MEDIA_VARIANT_NAMES.map(async (name): Promise<[MediaVariantName, MediaVariantUrl]> => {
        const variant = variants.find((candidate) => candidate.name === name);
        if (!variant) {
          throw new Error(`Media ${id} has no ${name} variant.`);
        }

        const url = await this.storage.signedUrl(variant.storageKey, urlsExpireAt);
        return [name, { url, width: variant.width, height: variant.height }];
      }),
    );

    return {
      id,
      width,
      height,
      createdAt,
      variants: Object.fromEntries(signed) as Record<MediaVariantName, MediaVariantUrl>,
      urlsExpireAt,
    };
  }
}
