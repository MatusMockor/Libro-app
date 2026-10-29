import { z } from 'zod';
import type { MediaVariantUrl, MediaWithUrls } from '../domain/media.js';

const variantSchema = z.object({
  url: z.url().meta({ description: 'Signed URL of the WebP file, valid until urlsExpireAt' }),
  width: z.int(),
  height: z.int(),
});

export const mediaSchema = z
  .object({
    id: z.uuid(),
    width: z.int(),
    height: z.int(),
    createdAt: z.iso.datetime(),
    variants: z
      .object({
        small: variantSchema.meta({ description: 'Longer side at most 256 px' }),
        medium: variantSchema.meta({ description: 'Longer side at most 1080 px' }),
        large: variantSchema.meta({ description: 'Longer side at most 2048 px' }),
      })
      .meta({ description: 'WebP renditions, never larger than the uploaded image' }),
    urlsExpireAt: z.iso.datetime().meta({
      description: 'When the variant URLs stop working; fetch the media again for fresh URLs',
    }),
  })
  .meta({ id: 'Media' });

export type MediaResponse = z.infer<typeof mediaSchema>;

export function toMediaResponse({
  id,
  width,
  height,
  createdAt,
  variants,
  urlsExpireAt,
}: MediaWithUrls): MediaResponse {
  return {
    id,
    width,
    height,
    createdAt: createdAt.toISOString(),
    variants: {
      small: toVariantResponse(variants.small),
      medium: toVariantResponse(variants.medium),
      large: toVariantResponse(variants.large),
    },
    urlsExpireAt: urlsExpireAt.toISOString(),
  };
}

function toVariantResponse({ url, width, height }: MediaVariantUrl): MediaVariantUrl {
  return { url, width, height };
}
