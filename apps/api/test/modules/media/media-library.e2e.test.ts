import { randomUUID } from 'node:crypto';
import { describe, expect } from 'vitest';
import {
  MAX_MEDIA_PER_CALL,
  MEDIA_LIBRARY,
  type MediaLibrary,
} from '../../../src/modules/media/index.js';
import { jpeg } from './images.js';
import { fetchFile, pathOf, test as base } from './media.fixture.js';

const test = base.extend('library', { scope: 'file' }, ({ app }) =>
  app.get<MediaLibrary>(MEDIA_LIBRARY),
);

describe('MEDIA_LIBRARY findMany', () => {
  test('answers media of any owner with working signed URLs and skips unknown ids', async ({
    http,
    library,
    newUploader,
  }) => {
    const [ann, ben] = [await newUploader(), await newUploader()];
    const annsPhoto = await ann.uploaded(await jpeg({ width: 800, height: 600 }));
    const bensPhoto = await ben.uploaded(await jpeg({ width: 600, height: 800 }));

    const found = await library.findMany([annsPhoto.id, bensPhoto.id, randomUUID()]);
    const served = await fetchFile(http, pathOf(found.get(bensPhoto.id)?.variants.small.url ?? ''));

    expect(found.size).toBe(2);
    expect(found.get(annsPhoto.id)).toMatchObject({
      id: annsPhoto.id,
      width: annsPhoto.width,
      height: annsPhoto.height,
      variants: {
        small: { width: annsPhoto.variants.small.width, height: annsPhoto.variants.small.height },
      },
    });
    expect(found.get(bensPhoto.id)?.urlsExpireAt).toBeInstanceOf(Date);
    expect(served.status).toBe(200);
  });

  test('answers an empty map for no ids', async ({ library }) => {
    expect((await library.findMany([])).size).toBe(0);
  });
});

describe('MEDIA_LIBRARY findMany batch limit', () => {
  test('answers each repeated media once', async ({ library, uploader }) => {
    const photo = await uploader.uploaded(await jpeg({ width: 400, height: 300 }));

    const found = await library.findMany([photo.id, photo.id]);

    expect([...found.keys()]).toEqual([photo.id]);
  });

  test('accepts 100 distinct ids, counting repeats once', async ({ library }) => {
    const ids = Array.from({ length: MAX_MEDIA_PER_CALL }, () => randomUUID());

    expect((await library.findMany([...ids, ids[0] ?? ''])).size).toBe(0);
  });

  test('throws a RangeError for more than 100 distinct ids', async ({ library }) => {
    const ids = Array.from({ length: MAX_MEDIA_PER_CALL + 1 }, () => randomUUID());

    await expect(library.findMany(ids)).rejects.toThrow(RangeError);
  });
});
