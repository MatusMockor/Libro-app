import { setSeederFactory, type FactoryCallback } from 'typeorm-extension';
import { MEDIA_VARIANT_NAMES, type MediaVariantName } from '../domain/media-variant.js';
import { storageKeyOf } from '../domain/storage-key.js';
import { MediaFileEntity } from '../persistence/media-file.entity.js';
import { toMediaFileEntity } from '../persistence/media-file.mapper.js';

export interface MediaFileFactoryMeta {
  ownerId?: string;
}

const FIRST_SERIAL = 1;

const SYNTHETIC_ID_DIGITS = 12;

const SAMPLE_SIZE = { width: 2048, height: 1536 };

const SAMPLE_VARIANTS: Readonly<Record<MediaVariantName, { width: number; height: number }>> = {
  small: { width: 256, height: 192 },
  medium: { width: 1080, height: 810 },
  large: SAMPLE_SIZE,
};

const SAMPLE_BYTE_SIZE = 1024;

export function createMediaFileFactory(): FactoryCallback<MediaFileEntity, MediaFileFactoryMeta> {
  let serial = FIRST_SERIAL;

  return (meta) => sampleMediaFile(serial++, meta ?? {});
}

export default setSeederFactory(MediaFileEntity, createMediaFileFactory());

function sampleMediaFile(serial: number, { ownerId }: MediaFileFactoryMeta): MediaFileEntity {
  const id = syntheticId('8', serial);

  return toMediaFileEntity({
    id,
    ownerId: ownerId ?? syntheticId('9', serial),
    ...SAMPLE_SIZE,
    variants: MEDIA_VARIANT_NAMES.map((name) => ({
      name,
      storageKey: storageKeyOf(id, name),
      ...SAMPLE_VARIANTS[name],
      byteSize: SAMPLE_BYTE_SIZE,
    })),
  });
}

function syntheticId(variant: string, serial: number): string {
  return `00000000-0000-4000-${variant}000-${String(serial).padStart(SYNTHETIC_ID_DIGITS, '0')}`;
}
