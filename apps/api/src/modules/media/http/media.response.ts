import { z } from 'zod';
import type { MediaWithUrls } from '../domain/media.js';
import {
  mediaVariantsSchema,
  toMediaVariantsResponse,
  urlsExpireAtSchema,
} from './media-photo.response.js';

export const mediaSchema = z
  .object({
    id: z.uuid(),
    width: z.int(),
    height: z.int(),
    createdAt: z.iso.datetime(),
    variants: mediaVariantsSchema.meta({
      description: 'WebP renditions, never larger than the uploaded image',
    }),
    urlsExpireAt: urlsExpireAtSchema('media'),
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
    variants: toMediaVariantsResponse(variants),
    urlsExpireAt: urlsExpireAt.toISOString(),
  };
}
