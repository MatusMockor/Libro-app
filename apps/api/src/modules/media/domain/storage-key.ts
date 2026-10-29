import type { MediaVariantName } from './media-variant.js';

export const MEDIA_CONTENT_TYPE = 'image/webp';

const STORAGE_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(small|medium|large)\.webp$/;

export function storageKeyOf(mediaId: string, variant: MediaVariantName): string {
  return `${mediaId}/${variant}.webp`;
}

export function isStorageKey(key: string): boolean {
  return STORAGE_KEY_PATTERN.test(key);
}
