import { access, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import type { MediaFileFactoryMeta } from '../../../src/modules/media/factories/media-file.factory.js';
import type { MediaResponse } from '../../../src/modules/media/http/media.response.js';
import { MediaFileEntity } from '../../../src/modules/media/persistence/media-file.entity.js';
import { MEDIA_LIBRARY, type MediaLibrary } from '../../../src/modules/media/index.js';
import { jpeg } from './images.js';
import { fetchFile, MEDIA_ROUTE, pathOf, storageKeyOfUrl, test } from './media.fixture.js';

const UNKNOWN_MEDIA_ID = '6f1d2c3b-4a59-4e8f-9a0b-1c2d3e4f5a6b';

const VARIANTS = ['small', 'medium', 'large'] as const;

function mediaNotFound(mediaId: string) {
  return {
    type: 'about:blank',
    title: 'Not Found',
    status: 404,
    detail: `No media with id ${mediaId} was found.`,
    instance: `${MEDIA_ROUTE}/${mediaId}`,
    code: 'media_not_found',
  };
}

async function existsOnDisk(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

function variantPaths(mediaRoot: string, media: MediaResponse): string[] {
  return VARIANTS.map((name) => join(mediaRoot, storageKeyOfUrl(media.variants[name].url)));
}

async function storedMediaRows(dataSource: DataSource): Promise<number | undefined> {
  const [row] = await dataSource.query<{ rows: number }[]>(
    `SELECT (SELECT count(*) FROM media.files) + (SELECT count(*) FROM media.file_variants) AS rows`,
  );

  return Number(row?.rows);
}

describe('GET /v1/media/:mediaId', () => {
  test('answers the own media with fresh signed URLs', async ({ http, uploader }) => {
    const uploaded = await uploader.uploaded(await jpeg({ width: 1200, height: 800 }));

    const response = await uploader.get(uploaded.id);
    const media = response.body as MediaResponse;

    expect(response.status).toBe(200);
    expect({ ...media, variants: undefined, urlsExpireAt: undefined }).toEqual({
      ...uploaded,
      variants: undefined,
      urlsExpireAt: undefined,
    });
    for (const name of VARIANTS) {
      expect(media.variants[name]).toMatchObject({
        width: uploaded.variants[name].width,
        height: uploaded.variants[name].height,
      });
      expect((await fetchFile(http, pathOf(media.variants[name].url))).status).toBe(200);
    }
  });

  test('answers media arranged by the factory', async ({ uploader, factories }) => {
    const arranged = await factories
      .get<MediaFileEntity, MediaFileFactoryMeta>(MediaFileEntity)
      .setMeta({ ownerId: uploader.id })
      .save();

    const response = await uploader.get(arranged.id);
    const media = response.body as MediaResponse;

    expect(response.status).toBe(200);
    expect(media).toMatchObject({ id: arranged.id, width: 2048, height: 1536 });
    expect(VARIANTS.map((name) => storageKeyOfUrl(media.variants[name].url))).toEqual(
      VARIANTS.map((name) => `${arranged.id}/${name}.webp`),
    );
  });

  test('answers 404 media_not_found for the media of another user or an unknown id', async ({
    uploader,
    newUploader,
  }) => {
    const media = await uploader.uploaded(await jpeg({ width: 40, height: 30 }));
    const other = await newUploader();

    const foreign = await other.get(media.id);
    const unknown = await uploader.get(UNKNOWN_MEDIA_ID);

    expect(foreign.status).toBe(404);
    expect(foreign.body).toStrictEqual(mediaNotFound(media.id));
    expect(unknown.status).toBe(404);
    expect(unknown.body).toStrictEqual(mediaNotFound(UNKNOWN_MEDIA_ID));
  });

  test('answers 400 validation_failed for an id that is not a UUID', async ({ uploader }) => {
    const response = await uploader.get('not-a-uuid');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'validation_failed' });
  });

  test('answers 401 without an access token', async ({ http, uploader }) => {
    const media = await uploader.uploaded(await jpeg({ width: 40, height: 30 }));

    const response = await http.get(`${MEDIA_ROUTE}/${media.id}`);

    expect(response.status).toBe(401);
  });
});

describe('DELETE /v1/media/:mediaId', () => {
  test('deletes the own media and its files', async ({ uploader, mediaRoot, dataSource }) => {
    const media = await uploader.uploaded(await jpeg({ width: 1200, height: 800 }));
    const paths = variantPaths(mediaRoot, media);
    for (const path of paths) {
      expect(await existsOnDisk(path)).toBe(true);
    }

    const response = await uploader.delete(media.id);
    const afterwards = await uploader.get(media.id);

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    for (const path of paths) {
      expect(await existsOnDisk(path)).toBe(false);
    }
    expect(await readdir(mediaRoot)).toEqual([]);
    expect(await storedMediaRows(dataSource)).toBe(0);
    expect(afterwards.status).toBe(404);
  });

  test('answers 404 media_not_found for the media of another user and keeps its files', async ({
    uploader,
    newUploader,
    mediaRoot,
  }) => {
    const media = await uploader.uploaded(await jpeg({ width: 40, height: 30 }));
    const other = await newUploader();

    const response = await other.delete(media.id);

    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual(mediaNotFound(media.id));
    for (const path of variantPaths(mediaRoot, media)) {
      expect(await existsOnDisk(path)).toBe(true);
    }
    expect((await uploader.get(media.id)).status).toBe(200);
  });

  test('answers 404 media_not_found for an unknown or already deleted media', async ({
    uploader,
  }) => {
    const media = await uploader.uploaded(await jpeg({ width: 40, height: 30 }));
    await uploader.delete(media.id);

    const again = await uploader.delete(media.id);
    const unknown = await uploader.delete(UNKNOWN_MEDIA_ID);

    expect(again.body).toStrictEqual(mediaNotFound(media.id));
    expect(unknown.body).toStrictEqual(mediaNotFound(UNKNOWN_MEDIA_ID));
  });

  test('answers 204 when the files are already gone from the storage', async ({
    uploader,
    mediaRoot,
    dataSource,
  }) => {
    const media = await uploader.uploaded(await jpeg({ width: 40, height: 30 }));
    await rm(join(mediaRoot, media.id), { recursive: true });

    const response = await uploader.delete(media.id);

    expect(response.status).toBe(204);
    expect(await storedMediaRows(dataSource)).toBe(0);
  });
});

describe('MEDIA_LIBRARY', () => {
  test('finds the own media with signed URLs and nothing for another user', async ({
    app,
    uploader,
    newUploader,
  }) => {
    const library = app.get<MediaLibrary>(MEDIA_LIBRARY);
    const uploaded = await uploader.uploaded(await jpeg({ width: 400, height: 300 }));
    const other = await newUploader();

    const own = await library.findOwned(uploader.id, uploaded.id);
    const foreign = await library.findOwned(other.id, uploaded.id);

    expect(own).toMatchObject({ id: uploaded.id, width: 400, height: 300 });
    expect(own?.createdAt).toBeInstanceOf(Date);
    expect(storageKeyOfUrl(own?.variants.large.url ?? '')).toBe(`${uploaded.id}/large.webp`);
    expect(foreign).toBeUndefined();
  });
});
