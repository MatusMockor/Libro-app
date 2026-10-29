import { access, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import type { DataSource } from 'typeorm';
import { describe, expect, onTestFinished } from 'vitest';
import { MEDIA_FILE_DELETIONS, type MediaFileDeletions } from '../../../src/modules/media/index.js';
import { jpeg } from './images.js';
import { fetchFile, pathOf, test } from './media.fixture.js';

const READ_ONLY = 0o555;
const WRITABLE = 0o755;

interface PendingRow {
  readonly storageKey: string;
  readonly attempts: number;
  readonly lastError: string | null;
}

function pendingRows(dataSource: DataSource): Promise<PendingRow[]> {
  return dataSource.query<PendingRow[]>(
    `SELECT storage_key AS "storageKey", attempts, last_error AS "lastError"
     FROM media.pending_file_deletions ORDER BY storage_key`,
  );
}

function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

async function readOnly(directory: string): Promise<void> {
  await chmod(directory, READ_ONLY);
  onTestFinished(async () => {
    await chmod(directory, WRITABLE).catch(() => undefined);
  });
}

describe('pending media file deletions', () => {
  test('deletes the files and leaves nothing pending when the storage works', async ({
    dataSource,
    mediaRoot,
    uploader,
  }) => {
    const media = await uploader.uploaded(await jpeg({ width: 64, height: 48 }));

    const response = await uploader.delete(media.id);

    expect(response.status).toBe(204);
    expect(await pendingRows(dataSource)).toEqual([]);
    expect(await exists(join(mediaRoot, media.id))).toBe(false);
  });

  test('keeps the files pending with the error when the storage refuses the deletion', async ({
    http,
    dataSource,
    mediaRoot,
    uploader,
  }) => {
    const media = await uploader.uploaded(await jpeg({ width: 64, height: 48 }));
    await readOnly(join(mediaRoot, media.id));

    const response = await uploader.delete(media.id);
    const served = await fetchFile(http, pathOf(media.variants.small.url));
    const pending = await pendingRows(dataSource);

    expect(response.status).toBe(204);
    expect(pending.map(({ storageKey, attempts }) => ({ storageKey, attempts }))).toEqual([
      { storageKey: `${media.id}/large.webp`, attempts: 1 },
      { storageKey: `${media.id}/medium.webp`, attempts: 1 },
      { storageKey: `${media.id}/small.webp`, attempts: 1 },
    ]);
    expect(pending.every(({ lastError }) => lastError?.includes('EACCES'))).toBe(true);
    expect(await exists(join(mediaRoot, media.id, 'small.webp'))).toBe(true);
    expect(served.status).toBe(404);
    expect(JSON.parse((served.body as Buffer).toString())).toMatchObject({
      status: 404,
      code: 'media_file_not_found',
    });
  });

  test('deletes pending files on a retry once the storage works again', async ({
    app,
    dataSource,
    mediaRoot,
    uploader,
  }) => {
    const media = await uploader.uploaded(await jpeg({ width: 64, height: 48 }));
    const directory = join(mediaRoot, media.id);
    await readOnly(directory);
    await uploader.delete(media.id);
    const deletions = app.get<MediaFileDeletions>(MEDIA_FILE_DELETIONS);
    const stillFailing = await deletions.retryPending();
    await chmod(directory, WRITABLE);

    const report = await deletions.retryPending();

    expect(stillFailing).toStrictEqual({ deleted: 0, failed: 3 });
    expect(report).toStrictEqual({ deleted: 3, failed: 0 });
    expect(await pendingRows(dataSource)).toEqual([]);
    expect(await exists(directory)).toBe(false);
  });

  test('retries older pending files after the next deletion', async ({
    dataSource,
    mediaRoot,
    uploader,
  }) => {
    const first = await uploader.uploaded(await jpeg({ width: 64, height: 48 }));
    const second = await uploader.uploaded(await jpeg({ width: 64, height: 48 }));
    const directory = join(mediaRoot, first.id);
    await readOnly(directory);
    await uploader.delete(first.id);
    await chmod(directory, WRITABLE);

    await uploader.delete(second.id);

    expect(await pendingRows(dataSource)).toEqual([]);
    expect(await exists(directory)).toBe(false);
    expect(await exists(join(mediaRoot, second.id))).toBe(false);
  });

  test('never serves a file of deleted media from its old signed URL', async ({
    http,
    uploader,
  }) => {
    const media = await uploader.uploaded(await jpeg({ width: 64, height: 48 }));
    await uploader.delete(media.id);

    const served = await fetchFile(http, pathOf(media.variants.medium.url));

    expect(served.status).toBe(404);
  });
});
