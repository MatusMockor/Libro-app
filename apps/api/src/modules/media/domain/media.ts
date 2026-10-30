import type { MediaVariantName } from './media-variant.js';

export interface MediaVariant {
  readonly name: MediaVariantName;
  readonly storageKey: string;
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
}

export interface NewMedia {
  readonly id: string;
  readonly ownerId: string;
  readonly width: number;
  readonly height: number;
  readonly variants: readonly MediaVariant[];
}

export interface StoredMedia extends NewMedia {
  readonly createdAt: Date;
}

export interface MediaVariantUrl {
  readonly url: string;
  readonly width: number;
  readonly height: number;
}

export interface MediaWithUrls {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly createdAt: Date;
  readonly variants: Readonly<Record<MediaVariantName, MediaVariantUrl>>;
  readonly urlsExpireAt: Date;
}

export type MediaPhoto = Pick<
  MediaWithUrls,
  'id' | 'width' | 'height' | 'variants' | 'urlsExpireAt'
>;

export function toMediaPhoto({
  id,
  width,
  height,
  variants,
  urlsExpireAt,
}: MediaWithUrls): MediaPhoto {
  return { id, width, height, variants, urlsExpireAt };
}
