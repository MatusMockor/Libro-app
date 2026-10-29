import type { NewMedia } from '../domain/media.js';
import { MediaFileVariantEntity } from './media-file-variant.entity.js';
import { MediaFileEntity } from './media-file.entity.js';

export function toMediaFileEntity({
  id,
  ownerId,
  width,
  height,
  variants,
}: NewMedia): MediaFileEntity {
  return Object.assign(new MediaFileEntity(), {
    id,
    ownerId,
    width,
    height,
    variants: variants.map((variant) =>
      Object.assign(new MediaFileVariantEntity(), { ...variant, fileId: id }),
    ),
  });
}
