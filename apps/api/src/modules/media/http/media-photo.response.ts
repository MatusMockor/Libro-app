import { z } from 'zod';
import type { MediaPhoto, MediaVariantUrl, MediaWithUrls } from '../domain/media.js';

const variantSchema = z.object({
  url: z.url().meta({ description: 'Signed URL of the WebP file, valid until urlsExpireAt' }),
  width: z.int(),
  height: z.int(),
});

export const mediaVariantsSchema = z.object({
  small: variantSchema.meta({ description: 'Longer side at most 256 px' }),
  medium: variantSchema.meta({ description: 'Longer side at most 1080 px' }),
  large: variantSchema.meta({ description: 'Longer side at most 2048 px' }),
});

export type MediaVariantsResponse = z.infer<typeof mediaVariantsSchema>;

export function urlsExpireAtSchema(refreshedBy: string) {
  return z.iso.datetime().meta({
    description: `When the variant URLs stop working; fetch the ${refreshedBy} again for fresh URLs`,
  });
}

export function mediaPhotoFields(refreshedBy: string) {
  return {
    mediaId: z.uuid(),
    width: z.int().meta({ description: 'Width of the large variant' }),
    height: z.int().meta({ description: 'Height of the large variant' }),
    variants: mediaVariantsSchema,
    urlsExpireAt: urlsExpireAtSchema(refreshedBy),
  };
}

export interface MediaPhotoResponse {
  readonly mediaId: string;
  readonly width: number;
  readonly height: number;
  readonly variants: MediaVariantsResponse;
  readonly urlsExpireAt: string;
}

export function toMediaVariantsResponse(
  variants: MediaWithUrls['variants'],
): MediaVariantsResponse {
  return {
    small: toVariantResponse(variants.small),
    medium: toVariantResponse(variants.medium),
    large: toVariantResponse(variants.large),
  };
}

export function toMediaPhotoResponse({
  id,
  width,
  height,
  variants,
  urlsExpireAt,
}: MediaPhoto): MediaPhotoResponse {
  return {
    mediaId: id,
    width,
    height,
    variants: toMediaVariantsResponse(variants),
    urlsExpireAt: urlsExpireAt.toISOString(),
  };
}

function toVariantResponse({ url, width, height }: MediaVariantUrl): MediaVariantUrl {
  return { url, width, height };
}
