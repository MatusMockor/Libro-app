import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { describe, expect } from 'vitest';
import type { MediaResponse } from '../../../src/modules/media/http/media.response.js';
import { jpeg } from './images.js';
import { fetchFile, pathOf, storageKeyOfUrl, test } from './media.fixture.js';

const FILES_ROUTE = '/v1/media/files';

const nowInSeconds = (): number => Math.floor(Date.now() / 1000);

const INVALID_SIGNATURE = {
  type: 'about:blank',
  title: 'Forbidden',
  status: 403,
  detail: 'The media URL is invalid or has expired; request the media again for a fresh URL.',
  code: 'invalid_media_signature',
};

function signedPath(key: string, expires: number, signature: string): string {
  return `${FILES_ROUTE}/${key}?expires=${String(expires)}&signature=${signature}`;
}

function tamper(signature: string): string {
  const last = signature.endsWith('A') ? 'B' : 'A';

  return `${signature.slice(0, -1)}${last}`;
}

describe('GET /v1/media/files/*key', () => {
  test('serves a variant behind its signed URL without an access token', async ({
    http,
    uploader,
  }) => {
    const media = await uploader.uploaded(await jpeg({ width: 1600, height: 1200 }));
    const expires = Number(new URL(media.variants.medium.url).searchParams.get('expires'));

    const response = await fetchFile(http, pathOf(media.variants.medium.url));
    const body = response.body as Buffer;
    const served = await sharp(body).metadata();
    const maxAge = Number(/max-age=(\d+)/.exec(response.headers['cache-control'] ?? '')?.[1]);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('image/webp');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['cache-control']).toMatch(/^private, max-age=\d+$/);
    expect(maxAge).toBeGreaterThan(0);
    expect(maxAge).toBeLessThanOrEqual(expires - nowInSeconds() + 1);
    expect(response.headers['content-length']).toBe(String(body.length));
    expect({ format: served.format, width: served.width, height: served.height }).toEqual({
      format: 'webp',
      width: 1080,
      height: 810,
    });
  });

  test('answers 403 invalid_media_signature for a tampered signature', async ({
    http,
    uploader,
  }) => {
    const media = await uploader.uploaded(await jpeg({ width: 400, height: 300 }));
    const url = new URL(media.variants.small.url);
    const key = storageKeyOfUrl(media.variants.small.url);
    const expires = Number(url.searchParams.get('expires'));
    const signature = url.searchParams.get('signature') ?? '';

    const tampered = await http.get(signedPath(key, expires, tamper(signature)));
    const laterExpiry = await http.get(signedPath(key, expires + 3600, signature));
    const otherVariant = await http.get(
      signedPath(key.replace('small', 'large'), expires, signature),
    );

    for (const response of [tampered, laterExpiry, otherVariant]) {
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject(INVALID_SIGNATURE);
    }
  });

  test.for([
    { name: 'no signature', query: '' },
    { name: 'an empty signature', query: '?expires=99999999999&signature=' },
    { name: 'a malformed expiry', query: '?expires=soon&signature=abc' },
  ])('answers 403 invalid_media_signature for $name', async ({ query }, { http, uploader }) => {
    const media = await uploader.uploaded(await jpeg({ width: 40, height: 30 }));

    const response = await http.get(`${FILES_ROUTE}/${media.id}/small.webp${query}`);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject(INVALID_SIGNATURE);
  });

  test('answers 403 invalid_media_signature for an expired URL', async ({
    http,
    uploader,
    signature,
  }) => {
    const media = await uploader.uploaded(await jpeg({ width: 400, height: 300 }));
    const key = storageKeyOfUrl(media.variants.small.url);
    const expired = nowInSeconds() - 1;

    const response = await http.get(signedPath(key, expired, signature.sign(key, expired)));

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject(INVALID_SIGNATURE);
  });

  test('answers 404 media_file_not_found for a signed key without a file', async ({
    http,
    signature,
  }) => {
    const key = '0b5e1c2d-3f4a-4b6c-8d9e-0f1a2b3c4d5e/small.webp';
    const expires = nowInSeconds() + 60;

    const response = await http.get(signedPath(key, expires, signature.sign(key, expires)));

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ status: 404, code: 'media_file_not_found' });
  });

  test.for([
    { name: 'a parent directory', key: '../outside.webp' },
    { name: 'an encoded parent directory', key: '..%2Foutside.webp' },
    { name: 'an absolute path', key: '%2Ftmp%2Foutside.webp' },
    { name: 'a key outside the pattern', key: 'outside.webp' },
  ])(
    'never serves a file outside the storage root through $name',
    async ({ key }, { http, mediaRoot, signature }) => {
      const outside = join(dirname(mediaRoot), 'outside.webp');
      await mkdir(mediaRoot, { recursive: true });
      await writeFile(
        outside,
        await sharp(await jpeg({ width: 8, height: 8 }))
          .webp()
          .toBuffer(),
      );
      const decodedKey = decodeURIComponent(key);
      const expires = nowInSeconds() + 60;

      const unsigned = await http.get(`${FILES_ROUTE}/${key}?expires=${String(expires)}`);
      const signed = await http.get(signedPath(key, expires, signature.sign(decodedKey, expires)));

      expect(unsigned.status).toBe(403);
      expect([403, 404]).toContain(signed.status);
      expect(signed.headers['content-type']).toMatch(/^application\/problem\+json/);
    },
  );

  test('signs a fresh URL for every request of the media', async ({ uploader }) => {
    const uploaded = await uploader.uploaded(await jpeg({ width: 40, height: 30 }));

    const response = await uploader.get(uploaded.id);
    const media = response.body as MediaResponse;

    expect(response.status).toBe(200);
    expect(storageKeyOfUrl(media.variants.small.url)).toBe(`${uploaded.id}/small.webp`);
    expect(Date.parse(media.urlsExpireAt)).toBeGreaterThanOrEqual(
      Date.parse(uploaded.urlsExpireAt),
    );
  });
});
