import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { MediaWithUrls, NewMedia, StoredMedia } from '../domain/media.js';
import { MAX_MEDIA_PER_USER } from '../domain/media-limits.js';
import { MEDIA_CONTENT_TYPE, storageKeyOf } from '../domain/storage-key.js';
import { FILE_STORAGE, type FileStorage } from './file-storage.js';
import { IMAGE_PROCESSOR, type ImageProcessor, type ProcessedImage } from './image-processor.js';
import { MediaFileCleanupService } from './media-file-cleanup.service.js';
import { MediaLimitReachedException } from './media-limit-reached.exception.js';
import { MEDIA_REPOSITORY, type MediaRepository } from './media-repository.js';
import { MediaUrlsService } from './media-urls.service.js';

@Injectable()
export class UploadMediaService {
  constructor(
    @Inject(IMAGE_PROCESSOR) private readonly processor: ImageProcessor,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(MEDIA_REPOSITORY) private readonly media: MediaRepository,
    private readonly cleanup: MediaFileCleanupService,
    private readonly urls: MediaUrlsService,
  ) {}

  async upload(ownerId: string, data: Buffer): Promise<MediaWithUrls> {
    await this.ensureBelowLimit(ownerId);
    const image = await this.processor.process(data);
    const media = newMedia(randomUUID(), ownerId, image);

    await this.store(media, image);

    return this.urls.withUrls(await this.record(media));
  }

  private async ensureBelowLimit(ownerId: string): Promise<void> {
    if ((await this.media.countOwned(ownerId)) >= MAX_MEDIA_PER_USER) {
      throw new MediaLimitReachedException(MAX_MEDIA_PER_USER);
    }
  }

  private async store(media: NewMedia, image: ProcessedImage): Promise<void> {
    const writes = await Promise.allSettled(
      image.variants.map(({ name, data }) =>
        this.storage.put(storageKeyOf(media.id, name), data, MEDIA_CONTENT_TYPE),
      ),
    );
    const failed = writes.find((write) => write.status === 'rejected');
    if (!failed) {
      return;
    }

    await this.cleanup.removeQuietly(storageKeysOf(media));
    throw failed.reason;
  }

  private async record(media: NewMedia): Promise<StoredMedia> {
    try {
      return await this.media.add(media, MAX_MEDIA_PER_USER);
    } catch (error) {
      await this.cleanup.removeQuietly(storageKeysOf(media));
      throw error;
    }
  }
}

function newMedia(
  id: string,
  ownerId: string,
  { width, height, variants }: ProcessedImage,
): NewMedia {
  return {
    id,
    ownerId,
    width,
    height,
    variants: variants.map(({ name, data, width: variantWidth, height: variantHeight }) => ({
      name,
      storageKey: storageKeyOf(id, name),
      width: variantWidth,
      height: variantHeight,
      byteSize: data.byteLength,
    })),
  };
}

function storageKeysOf({ variants }: NewMedia): string[] {
  return variants.map(({ storageKey }) => storageKey);
}
