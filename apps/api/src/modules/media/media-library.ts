import type { MediaWithUrls } from './domain/media.js';

export const MEDIA_LIBRARY = Symbol('MEDIA_LIBRARY');

export interface MediaLibrary {
  findOwned(userId: string, mediaId: string): Promise<MediaWithUrls | undefined>;
}
