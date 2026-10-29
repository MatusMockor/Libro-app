import type { NewMedia, StoredMedia } from '../domain/media.js';

export const MEDIA_REPOSITORY = Symbol('MEDIA_REPOSITORY');

export interface MediaRepository {
  countOwned(ownerId: string): Promise<number>;
  add(media: NewMedia, limit: number): Promise<StoredMedia>;
  findOwned(ownerId: string, mediaId: string): Promise<StoredMedia | undefined>;
  findMany(mediaIds: readonly string[]): Promise<StoredMedia[]>;
  deleteOwned(ownerId: string, mediaId: string): Promise<readonly string[] | undefined>;
}
