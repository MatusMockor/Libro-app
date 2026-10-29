import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import { jpeg } from './images.js';
import { fetchFile, pathOf, test } from './media.fixture.js';

const VARIANT_FILES = ['small.webp', 'medium.webp', 'large.webp'];

interface OutsideDirectory {
  readonly directory: string;
  readonly files: Map<string, Buffer>;
}

async function outsideDirectoryWithVariants(mediaRoot: string): Promise<OutsideDirectory> {
  const directory = join(dirname(mediaRoot), `outside-${randomUUID()}`);
  await mkdir(directory, { recursive: true });
  const content = await sharp(await jpeg({ width: 8, height: 8 }))
    .webp()
    .toBuffer();
  const files = new Map(VARIANT_FILES.map((file) => [join(directory, file), content]));
  for (const [path, data] of files) {
    await writeFile(path, data);
  }

  return { directory, files };
}

async function untouched(files: Map<string, Buffer>): Promise<boolean[]> {
  return Promise.all([...files].map(async ([path, data]) => (await readFile(path)).equals(data)));
}

async function storedMediaRows(dataSource: DataSource): Promise<number | undefined> {
  const [row] = await dataSource.query<{ rows: number }[]>(
    'SELECT (SELECT count(*) FROM media.files) + (SELECT count(*) FROM media.file_variants) AS rows',
  );

  return Number(row?.rows);
}

describe('the local storage and symlinks', () => {
  test('refuses a media directory replaced by a symlink to an outside directory', async ({
    http,
    uploader,
    mediaRoot,
    dataSource,
  }) => {
    const media = await uploader.uploaded(await jpeg({ width: 400, height: 300 }));
    const outside = await outsideDirectoryWithVariants(mediaRoot);
    const mediaDirectory = join(mediaRoot, media.id);
    await rm(mediaDirectory, { recursive: true });
    await symlink(outside.directory, mediaDirectory, 'dir');

    const served = await fetchFile(http, pathOf(media.variants.small.url));
    const deleted = await uploader.delete(media.id);

    expect(served.status).toBe(404);
    expect(served.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(deleted.status).toBe(204);
    expect(await storedMediaRows(dataSource)).toBe(0);
    expect(await untouched(outside.files)).toEqual([true, true, true]);
    expect((await lstat(mediaDirectory)).isSymbolicLink()).toBe(true);
  });

  test('refuses a variant file replaced by a symlink to an outside file', async ({
    http,
    uploader,
    mediaRoot,
  }) => {
    const media = await uploader.uploaded(await jpeg({ width: 400, height: 300 }));
    const outside = await outsideDirectoryWithVariants(mediaRoot);
    const variant = join(mediaRoot, media.id, 'small.webp');
    await rm(variant);
    await symlink(join(outside.directory, 'small.webp'), variant, 'file');

    const served = await fetchFile(http, pathOf(media.variants.small.url));
    const otherVariant = await fetchFile(http, pathOf(media.variants.medium.url));
    const deleted = await uploader.delete(media.id);

    expect(served.status).toBe(404);
    expect(otherVariant.status).toBe(200);
    expect(deleted.status).toBe(204);
    expect(await untouched(outside.files)).toEqual([true, true, true]);
    expect((await lstat(variant)).isSymbolicLink()).toBe(true);
  });
});
