export const MEDIA_STORAGE_DRIVERS = ['local'] as const;

export type MediaStorageDriver = (typeof MEDIA_STORAGE_DRIVERS)[number];
