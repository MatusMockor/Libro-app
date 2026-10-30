import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import type { Agent, Response, Test } from 'supertest';
import { expect } from 'vitest';
import type { Env } from '../../../src/config/env.schema.js';
import type { MediaResponse } from '../../../src/modules/media/http/media.response.js';
import { MediaUrlSignature } from '../../../src/modules/media/storage/local/media-url-signature.js';
import { integrationTest } from '../../support/integration-test.js';
import { ANY_ISO_DATE } from '../../support/matchers.js';
import type { SignedInUser } from '../../support/sign-in.js';
import { jpeg, type Size } from './images.js';

export const MEDIA_ROUTE = '/v1/media';

export const PUBLIC_API_URL = 'http://media.test';

export interface UploadOptions {
  readonly filename?: string;
  readonly contentType?: string;
}

export interface Uploader {
  readonly id: string;
  readonly authorization: string;
  upload(image: Buffer, options?: UploadOptions): Test;
  uploaded(image: Buffer): Promise<MediaResponse>;
  get(mediaId: string): Test;
  delete(mediaId: string): Test;
}

export type NewUploader = () => Promise<Uploader>;

function uploaderOf(http: Agent, { id, authorization }: SignedInUser): Uploader {
  const uploader: Uploader = {
    id,
    authorization,
    upload: (image, { filename = 'photo.jpg', contentType = 'image/jpeg' } = {}) =>
      http
        .post(MEDIA_ROUTE)
        .set('Authorization', authorization)
        .attach('file', image, { filename, contentType }),
    uploaded: async (image) => {
      const response = await uploader.upload(image);
      expect(response.status).toBe(201);

      return response.body as MediaResponse;
    },
    get: (mediaId) => http.get(`${MEDIA_ROUTE}/${mediaId}`).set('Authorization', authorization),
    delete: (mediaId) =>
      http.delete(`${MEDIA_ROUTE}/${mediaId}`).set('Authorization', authorization),
  };

  return uploader;
}

export const SIGNED_URL =
  /^http:\/\/media\.test\/v1\/media\/files\/[0-9a-f-]{36}\/(small|medium|large)\.webp\?expires=\d+&signature=[\w-]+$/;

export async function uploadPhoto(
  http: Agent,
  { authorization }: { readonly authorization: string },
  size: Size = { width: 1600, height: 1200 },
): Promise<MediaResponse> {
  const response = await http
    .post(MEDIA_ROUTE)
    .set('Authorization', authorization)
    .attach('file', await jpeg(size), { filename: 'photo.jpg', contentType: 'image/jpeg' });
  expect(response.status, 'upload photo').toBe(201);

  return response.body as MediaResponse;
}

export function expectedPhoto({ id, width, height, variants }: MediaResponse) {
  const variant = (size: { width: number; height: number }) => ({
    url: expect.stringMatching(SIGNED_URL) as string,
    width: size.width,
    height: size.height,
  });

  return {
    mediaId: id,
    width,
    height,
    variants: {
      small: variant(variants.small),
      medium: variant(variants.medium),
      large: variant(variants.large),
    },
    urlsExpireAt: ANY_ISO_DATE,
  };
}

export function pathOf(url: string): string {
  const { pathname, search } = new URL(url);

  return `${pathname}${search}`;
}

export function fetchFile(http: Agent, path: string): Promise<Response> {
  return http
    .get(path)
    .buffer(true)
    .parse((response, done) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => {
        done(null, Buffer.concat(chunks));
      });
    });
}

export function storageKeyOfUrl(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\/v1\/media\/files\//, ''));
}

export const test = integrationTest()
  .extend('mediaRoot', { scope: 'file' }, ({ app }) =>
    resolve(app.get<ConfigService<Env, true>>(ConfigService).get('MEDIA_LOCAL_ROOT')),
  )
  .extend('emptyMediaRoot', { auto: true }, async ({ mediaRoot }) => {
    await rm(mediaRoot, { recursive: true, force: true });
  })
  .extend('signature', { scope: 'file' }, ({ app }) => app.get(MediaUrlSignature))
  .extend(
    'newUploader',
    ({ http, signIn }) =>
      async () =>
        uploaderOf(http, await signIn()),
  )
  .extend('uploader', ({ newUploader }) => newUploader());
