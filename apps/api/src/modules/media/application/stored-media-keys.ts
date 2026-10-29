export const STORED_MEDIA_KEYS = Symbol('STORED_MEDIA_KEYS');

export interface StoredMediaKeys {
  isStored(storageKey: string): Promise<boolean>;
}
