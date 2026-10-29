export const MEDIA_VARIANT_NAMES = ['small', 'medium', 'large'] as const;

export type MediaVariantName = (typeof MEDIA_VARIANT_NAMES)[number];

export const MEDIA_VARIANT_LONGER_SIDE: Readonly<Record<MediaVariantName, number>> = {
  small: 256,
  medium: 1080,
  large: 2048,
};
