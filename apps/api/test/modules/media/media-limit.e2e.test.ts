import { readdir } from 'node:fs/promises';
import type { DataSource } from 'typeorm';
import type { SeederFactoryManager } from 'typeorm-extension';
import { describe, expect } from 'vitest';
import type { MediaFileFactoryMeta } from '../../../src/modules/media/factories/media-file.factory.js';
import { MediaLimitReachedException } from '../../../src/modules/media/application/media-limit-reached.exception.js';
import { UploadMediaService } from '../../../src/modules/media/application/upload-media.service.js';
import { MediaFileEntity } from '../../../src/modules/media/persistence/media-file.entity.js';
import { requestsWaitingForSessionLock } from '../../support/session-lock.js';
import { jpeg } from './images.js';
import { MEDIA_ROUTE, test } from './media.fixture.js';

const MAX_MEDIA_PER_USER = 500;

const OWNER_LOCK_QUERY = '%pg_advisory_xact_lock%media.files/%';

const LOCK_OWNER = `SELECT pg_advisory_xact_lock(hashtextextended('media.files/' || $1::text, 0))`;

async function arrangeMedia(
  factories: SeederFactoryManager,
  dataSource: DataSource,
  ownerId: string,
  count: number,
): Promise<void> {
  const factory = factories
    .get<MediaFileEntity, MediaFileFactoryMeta>(MediaFileEntity)
    .setMeta({ ownerId });
  const media: MediaFileEntity[] = [];
  for (let made = 0; made < count; made += 1) {
    media.push(await factory.make());
  }

  await dataSource.getRepository(MediaFileEntity).save(media, { chunk: 100 });
}

async function ownedMedia(dataSource: DataSource, ownerId: string): Promise<number | undefined> {
  const [row] = await dataSource.query<{ owned: number }[]>(
    'SELECT count(*)::int AS owned FROM media.files WHERE owner_id = $1',
    [ownerId],
  );

  return row?.owned;
}

async function mediaDirectories(mediaRoot: string): Promise<string[]> {
  return readdir(mediaRoot).catch(() => []);
}

async function holdOwnerLock(dataSource: DataSource, ownerId: string) {
  const connection = dataSource.createQueryRunner();
  await connection.connect();
  await connection.startTransaction();
  await connection.query(LOCK_OWNER, [ownerId]);

  return async () => {
    await connection.commitTransaction();
    await connection.release();
  };
}

describe('the limit of 500 media per user', () => {
  test('answers 409 media_limit_reached at the limit and stores no file', async ({
    uploader,
    factories,
    dataSource,
    mediaRoot,
  }) => {
    await arrangeMedia(factories, dataSource, uploader.id, MAX_MEDIA_PER_USER);

    const response = await uploader.upload(await jpeg({ width: 40, height: 30 }));

    expect(response.status).toBe(409);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'A user can keep at most 500 media files; delete some before uploading more.',
      instance: MEDIA_ROUTE,
      code: 'media_limit_reached',
    });
    expect(await ownedMedia(dataSource, uploader.id)).toBe(MAX_MEDIA_PER_USER);
    expect(await mediaDirectories(mediaRoot)).toEqual([]);
  });

  test('accepts the last one and counts only the own media', async ({
    uploader,
    newUploader,
    factories,
    dataSource,
  }) => {
    const other = await newUploader();
    await arrangeMedia(factories, dataSource, other.id, MAX_MEDIA_PER_USER);
    await arrangeMedia(factories, dataSource, uploader.id, MAX_MEDIA_PER_USER - 1);

    const last = await uploader.upload(await jpeg({ width: 40, height: 30 }));
    const over = await uploader.upload(await jpeg({ width: 40, height: 30 }));

    expect(last.status).toBe(201);
    expect(over.status).toBe(409);
    expect(await ownedMedia(dataSource, uploader.id)).toBe(MAX_MEDIA_PER_USER);
  });

  test('lets only one of concurrent uploads take the last place and removes the files of the others', async ({
    app,
    uploader,
    factories,
    dataSource,
    mediaRoot,
  }) => {
    await arrangeMedia(factories, dataSource, uploader.id, MAX_MEDIA_PER_USER - 1);
    const uploads = app.get(UploadMediaService);
    const image = await jpeg({ width: 400, height: 300 });
    const release = await holdOwnerLock(dataSource, uploader.id);

    const racing = Promise.allSettled([1, 2, 3].map(() => uploads.upload(uploader.id, image)));
    const waiting = await requestsWaitingForSessionLock(dataSource, 3, OWNER_LOCK_QUERY);
    await release();
    const outcomes = await racing;
    const winners = outcomes.flatMap((outcome) =>
      outcome.status === 'fulfilled' ? [outcome.value.id] : [],
    );
    const losers = outcomes.flatMap((outcome) =>
      outcome.status === 'rejected' ? [outcome.reason as unknown] : [],
    );

    expect(waiting).toBe(3);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(2);
    for (const loser of losers) {
      expect(loser).toBeInstanceOf(MediaLimitReachedException);
    }
    expect(await ownedMedia(dataSource, uploader.id)).toBe(MAX_MEDIA_PER_USER);
    expect(await mediaDirectories(mediaRoot)).toEqual(winners);
  });
});
