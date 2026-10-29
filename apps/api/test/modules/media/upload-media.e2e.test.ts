import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type { MediaResponse } from '../../../src/modules/media/http/media.response.js';
import { ANY_ISO_DATE, ANY_UUID } from '../../support/matchers.js';
import {
  animatedWebp,
  avif,
  gif,
  hasGpsIfd,
  jpeg,
  jpegWithCameraMetadata,
  jpegWithOrientation,
  oversized,
  pixelBomb,
  png,
  svg,
  truncated,
  webp,
} from './images.js';
import { MEDIA_ROUTE, PUBLIC_API_URL, storageKeyOfUrl, test } from './media.fixture.js';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const VARIANTS = ['small', 'medium', 'large'] as const;

async function storedFileCount(dataSource: DataSource): Promise<number | undefined> {
  const [row] = await dataSource.query<{ files: number }[]>(
    'SELECT count(*)::int AS files FROM media.files',
  );

  return row?.files;
}

async function filesOnDisk(mediaRoot: string): Promise<string[]> {
  const entries = await readdir(mediaRoot, { recursive: true, withFileTypes: true }).catch(
    () => [],
  );

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .toSorted();
}

function problemOf(body: unknown): Pick<ProblemDetails, 'status' | 'code'> {
  const { status, code } = body as ProblemDetails;

  return { status, code };
}

describe('POST /v1/media', () => {
  test('stores a JPEG as three WebP variants and answers 201 with signed URLs', async ({
    uploader,
    mediaRoot,
  }) => {
    const response = await uploader.upload(await jpeg({ width: 3000, height: 2000 }));
    const media = response.body as MediaResponse;

    expect(response.status).toBe(201);
    expect(media).toStrictEqual({
      id: ANY_UUID,
      width: 2048,
      height: 1365,
      createdAt: ANY_ISO_DATE,
      variants: {
        small: { url: expect.any(String) as string, width: 256, height: 171 },
        medium: { url: expect.any(String) as string, width: 1080, height: 720 },
        large: { url: expect.any(String) as string, width: 2048, height: 1365 },
      },
      urlsExpireAt: ANY_ISO_DATE,
    });
    for (const name of VARIANTS) {
      const url = media.variants[name].url;
      expect(url).toMatch(
        new RegExp(
          `^${PUBLIC_API_URL}/v1/media/files/${media.id}/${name}\\.webp\\?expires=\\d+&signature=[A-Za-z0-9_-]{43}$`,
        ),
      );
      const stored = await sharp(join(mediaRoot, storageKeyOfUrl(url))).metadata();
      expect({ format: stored.format, width: stored.width, height: stored.height }).toEqual({
        format: 'webp',
        width: media.variants[name].width,
        height: media.variants[name].height,
      });
    }
    const expiresIn = Date.parse(media.urlsExpireAt) - Date.parse(media.createdAt);
    expect(expiresIn).toBeGreaterThan(3590_000);
    expect(expiresIn).toBeLessThanOrEqual(3600_000);
  });

  test('never enlarges a small image', async ({ uploader }) => {
    const media = await uploader.uploaded(await jpeg({ width: 300, height: 200 }));

    expect(media).toMatchObject({ width: 300, height: 200 });
    expect(
      VARIANTS.map((name) => [name, media.variants[name].width, media.variants[name].height]),
    ).toEqual([
      ['small', 256, 171],
      ['medium', 300, 200],
      ['large', 300, 200],
    ]);
  });

  test('drops EXIF with GPS, XMP and the ICC profile from every stored file', async ({
    uploader,
    mediaRoot,
  }) => {
    const image = await jpegWithCameraMetadata({ width: 1200, height: 900 });
    const original = await sharp(image).metadata();
    expect(hasGpsIfd(original.exif)).toBe(true);
    expect(original.xmp).toBeDefined();
    expect(original.icc).toBeDefined();

    const media = await uploader.uploaded(image);

    for (const name of VARIANTS) {
      const path = join(mediaRoot, storageKeyOfUrl(media.variants[name].url));
      const stored = await sharp(path).metadata();
      expect(stored).toMatchObject({ format: 'webp', space: 'srgb', hasProfile: false });
      expect(stored.exif).toBeUndefined();
      expect(stored.xmp).toBeUndefined();
      expect(stored.icc).toBeUndefined();
      expect(stored.iptc).toBeUndefined();
      expect(stored.orientation).toBeUndefined();
    }
  });

  test('applies the EXIF orientation', async ({ uploader, mediaRoot }) => {
    const media = await uploader.uploaded(
      await jpegWithOrientation({ width: 400, height: 200 }, 6),
    );
    const large = await sharp(
      join(mediaRoot, storageKeyOfUrl(media.variants.large.url)),
    ).metadata();

    expect(media).toMatchObject({ width: 200, height: 400 });
    expect({ width: large.width, height: large.height }).toEqual({ width: 200, height: 400 });
    expect(large.orientation).toBeUndefined();
  });

  test.for([
    { name: 'PNG', image: () => png({ width: 640, height: 480 }), contentType: 'image/png' },
    { name: 'WebP', image: () => webp({ width: 640, height: 480 }), contentType: 'image/webp' },
  ])('accepts a $name', async ({ image, contentType }, { uploader }) => {
    const response = await uploader.upload(await image(), { filename: 'photo', contentType });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ width: 640, height: 480 });
  });

  test('keeps only the first frame of an animated WebP', async ({ uploader, mediaRoot }) => {
    const image = await animatedWebp({ width: 40, height: 30 }, 3);
    expect((await sharp(image).metadata()).pages).toBe(3);

    const media = await uploader.uploaded(image);
    const stored = await sharp(
      join(mediaRoot, storageKeyOfUrl(media.variants.large.url)),
    ).metadata();

    expect(media).toMatchObject({ width: 40, height: 30 });
    expect({ pages: stored.pages ?? 1, width: stored.width, height: stored.height }).toEqual({
      pages: 1,
      width: 40,
      height: 30,
    });
  });

  test.for([
    { name: 'a GIF', image: () => gif({ width: 20, height: 20 }), contentType: 'image/gif' },
    {
      name: 'a HEIF image',
      image: () => avif({ width: 20, height: 20 }),
      contentType: 'image/heic',
    },
    { name: 'an SVG', image: () => Promise.resolve(svg()), contentType: 'image/svg+xml' },
    {
      name: 'a text file',
      image: () => Promise.resolve(Buffer.from('not an image at all')),
      contentType: 'text/plain',
    },
    {
      name: 'a GIF sent as image/jpeg',
      image: () => gif({ width: 20, height: 20 }),
      contentType: 'image/jpeg',
    },
    {
      name: 'a truncated JPEG',
      image: async () => truncated(await jpeg({ width: 800, height: 600 })),
      contentType: 'image/jpeg',
    },
  ])(
    'rejects $name with 415 unsupported_media_type and stores nothing',
    async ({ image, contentType }, { uploader, dataSource, mediaRoot }) => {
      const response = await uploader.upload(await image(), { filename: 'photo.jpg', contentType });

      expect(response.status).toBe(415);
      expect(response.body).toStrictEqual({
        type: 'about:blank',
        title: 'Unsupported Media Type',
        status: 415,
        detail: 'The file must be a JPEG, PNG or WebP image.',
        instance: MEDIA_ROUTE,
        code: 'unsupported_media_type',
      });
      expect(await storedFileCount(dataSource)).toBe(0);
      expect(await filesOnDisk(mediaRoot)).toEqual([]);
    },
  );

  test('rejects an image with more than 50 megapixels with 422 media_too_many_pixels', async ({
    uploader,
    dataSource,
  }) => {
    const response = await uploader.upload(await pixelBomb(), {
      filename: 'bomb.png',
      contentType: 'image/png',
    });

    expect(response.status).toBe(422);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Unprocessable Entity',
      status: 422,
      detail: 'The image must have at most 50000000 pixels.',
      instance: MEDIA_ROUTE,
      code: 'media_too_many_pixels',
    });
    expect(await storedFileCount(dataSource)).toBe(0);
  });

  test('rejects a file over 10 MiB with 413 media_too_large', async ({ uploader, dataSource }) => {
    const response = await uploader.upload(oversized(MAX_UPLOAD_BYTES + 1));

    expect(response.status).toBe(413);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Payload Too Large',
      status: 413,
      detail: 'The file must be at most 10 MiB.',
      instance: MEDIA_ROUTE,
      code: 'media_too_large',
    });
    expect(await storedFileCount(dataSource)).toBe(0);
  });

  test('rejects a request without a file with 400 validation_failed', async ({
    http,
    uploader,
  }) => {
    const response = await http
      .post(MEDIA_ROUTE)
      .set('Authorization', uploader.authorization)
      .field('note', 'no file');
    const withoutBody = await http.post(MEDIA_ROUTE).set('Authorization', uploader.authorization);

    expect(problemOf(response.body)).toEqual({ status: 400, code: 'validation_failed' });
    expect(withoutBody.status).toBe(400);
    expect(withoutBody.body).toStrictEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'The request contains invalid fields.',
      instance: MEDIA_ROUTE,
      code: 'validation_failed',
      errors: [
        {
          path: 'file',
          message: 'Expected an image file in the multipart field "file"',
          code: 'invalid_type',
        },
      ],
    });
  });

  test('rejects a second file with 400 validation_failed', async ({ http, uploader }) => {
    const image = await jpeg({ width: 20, height: 20 });

    const response = await http
      .post(MEDIA_ROUTE)
      .set('Authorization', uploader.authorization)
      .attach('file', image, { filename: 'a.jpg', contentType: 'image/jpeg' })
      .attach('file', image, { filename: 'b.jpg', contentType: 'image/jpeg' });

    expect(problemOf(response.body)).toEqual({ status: 400, code: 'validation_failed' });
  });

  test('answers 401 without an access token and stores nothing', async ({
    http,
    dataSource,
    mediaRoot,
  }) => {
    const response = await http
      .post(MEDIA_ROUTE)
      .attach('file', await jpeg({ width: 20, height: 20 }), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      });

    expect(problemOf(response.body)).toEqual({ status: 401, code: 'authentication_required' });
    expect(await storedFileCount(dataSource)).toBe(0);
    expect(await filesOnDisk(mediaRoot)).toEqual([]);
  });

  test('keeps the stored sizes of the variants in the database', async ({
    uploader,
    dataSource,
    mediaRoot,
  }) => {
    const media = await uploader.uploaded(await jpeg({ width: 1600, height: 1200 }));
    const rows = await dataSource.query<{ storageKey: string; byteSize: number }[]>(
      `SELECT storage_key AS "storageKey", byte_size AS "byteSize"
       FROM media.file_variants WHERE file_id = $1 ORDER BY storage_key`,
      [media.id],
    );

    expect(rows.map(({ storageKey }) => storageKey)).toEqual([
      `${media.id}/large.webp`,
      `${media.id}/medium.webp`,
      `${media.id}/small.webp`,
    ]);
    for (const { storageKey, byteSize } of rows) {
      expect((await stat(join(mediaRoot, storageKey))).size).toBe(byteSize);
    }
  });
});
