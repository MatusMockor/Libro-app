import type { MediaWithUrls } from './domain/media.js';

export const MEDIA_LIBRARY = Symbol('MEDIA_LIBRARY');

export const MAX_MEDIA_PER_CALL = 100;

export interface MediaLibrary {
  findOwned(userId: string, mediaId: string): Promise<MediaWithUrls | undefined>;
  findMany(mediaIds: readonly string[]): Promise<ReadonlyMap<string, MediaWithUrls>>;
}
