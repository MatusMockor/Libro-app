import { execFile } from 'node:child_process';
import { chmod } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { ConsoleLogger } from '@nestjs/common';
import { describe, expect, onTestFinished } from 'vitest';
import { EVENT_BUS, type EventBus } from '../../../src/events/event-bus.js';
import { UserDeleted } from '../../../src/modules/auth/index.js';
import { FACTORY_USER_PASSWORD } from '../../../src/modules/auth/factories/user.factory.js';
import type { ProfileFactoryMeta } from '../../../src/modules/profiles/factories/profile.factory.js';
import { ProfileEntity } from '../../../src/modules/profiles/persistence/profile.entity.js';
import { CapturingLogger } from '../../support/capturing-logger.js';
import {
  engagesWith,
  filesOf,
  follows,
  pendingFileDeletions,
  rowCounts,
  storedFiles,
  tablesMentioning,
  test,
  tombstones,
} from './account-deletion.fixture.js';

const API_ROOT = resolve(import.meta.dirname, '../../..');

const CLI_TIMEOUT_MS = 60_000;

const READ_ONLY = 0o555;
const WRITABLE = 0o755;

const execute = promisify(execFile);

interface CommandResult {
  readonly exitCode: number;
  readonly output: string;
}

async function runPurgeCommand(): Promise<CommandResult> {
  try {
    const { stdout, stderr } = await execute(
      'node',
      ['--import', '@oxc-node/core/register', 'src/cli/purge-deleted-accounts.ts'],
      { cwd: API_ROOT, env: process.env, timeout: CLI_TIMEOUT_MS },
    );

    return { exitCode: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };

    return {
      exitCode: failed.code ?? -1,
      output: `${failed.stdout ?? ''}${failed.stderr ?? ''}`,
    };
  }
}

describe('UserDeleted handlers', () => {
  test('are idempotent: publishing the event again changes nothing and logs no error', async ({
    app,
    http,
    dataSource,
    mediaRoot,
    arrangeAccount,
    deleteAccount,
  }) => {
    const ann = await arrangeAccount();
    const ben = await arrangeAccount();
    await follows(http, ben, ann);
    await engagesWith(http, ben, ann);
    await engagesWith(http, ann, ben);
    await deleteAccount(ann, { password: FACTORY_USER_PASSWORD });
    const countsAfterDeletion = await rowCounts(dataSource);
    const filesAfterDeletion = await storedFiles(mediaRoot);
    const logger = new CapturingLogger();
    app.useLogger(logger);
    onTestFinished(() => {
      app.useLogger(new ConsoleLogger());
    });

    const events = app.get<EventBus>(EVENT_BUS);
    await events.publish(UserDeleted.create({ userId: ann.id }));
    await events.publish(UserDeleted.create({ userId: ann.id }));

    expect(logger.errors).toEqual([]);
    expect(await rowCounts(dataSource)).toEqual(countsAfterDeletion);
    expect(await storedFiles(mediaRoot)).toEqual(filesAfterDeletion);
    expect(await tablesMentioning(dataSource, [ben.id])).toEqual(
      expect.arrayContaining([
        'feed.posts',
        'media.files',
        'profiles.profiles',
        'reading.readings',
      ]),
    );
  });
});

describe('delayed replay after a deletion', () => {
  test('schedules UserDeleted again after 2 and 10 minutes', async ({
    signIn,
    scheduler,
    deleteAccount,
  }) => {
    const ann = await signIn();

    await deleteAccount(ann, { password: FACTORY_USER_PASSWORD });

    expect(scheduler.delays()).toEqual([120_000, 600_000]);
  });

  test('erases data a request admitted before the deletion wrote after the first erase', async ({
    dataSource,
    mediaRoot,
    recorder,
    scheduler,
    arrangeAccount,
    arrangeLeftovers,
    deleteAccount,
  }) => {
    const ann = await arrangeAccount();
    const ben = await arrangeAccount();
    await deleteAccount(ann, { password: FACTORY_USER_PASSWORD });
    const benTablesBefore = await tablesMentioning(dataSource, [ben.id]);
    const late = await arrangeLeftovers(ann.id, ben.id);
    recorder.clear();

    await scheduler.runNext();

    expect(recorder.all().map(({ event }) => event.payload)).toEqual([{ userId: ann.id }]);
    expect(await tablesMentioning(dataSource, late.needles)).toEqual([]);
    expect(filesOf(await storedFiles(mediaRoot), late.mediaIds)).toEqual([]);
    expect(await tablesMentioning(dataSource, [ben.id])).toEqual(benTablesBefore);

    await scheduler.runNext();

    expect(recorder.all()).toHaveLength(2);
    expect(await tablesMentioning(dataSource, late.needles)).toEqual([]);
  });

  test('schedules nothing when the confirmation is refused', async ({
    signIn,
    scheduler,
    deleteAccount,
  }) => {
    const ann = await signIn();

    await deleteAccount(ann, { password: 'not the password' });

    expect(scheduler.delays()).toEqual([]);
  });
});

describe('deleted accounts purge', () => {
  test('publishes UserDeleted again so data a lost or failed handler left behind is removed', async ({
    dataSource,
    mediaRoot,
    recorder,
    purge,
    arrangeAccount,
    arrangeLeftovers,
    deleteAccount,
  }) => {
    const ann = await arrangeAccount();
    const ben = await arrangeAccount();
    await deleteAccount(ann, { password: FACTORY_USER_PASSWORD });
    const benTablesBefore = await tablesMentioning(dataSource, [ben.id]);
    const leftovers = await arrangeLeftovers(ann.id, ben.id);
    recorder.clear();

    const report = await purge();

    expect(report).toStrictEqual({
      replayed: 1,
      mediaFilesDeleted: 0,
      mediaFilesFailed: 0,
      forgotten: 0,
    });
    expect(recorder.all().map(({ event }) => event.payload)).toEqual([{ userId: ann.id }]);
    expect(await tablesMentioning(dataSource, leftovers.needles)).toEqual([]);
    expect(filesOf(await storedFiles(mediaRoot), leftovers.mediaIds)).toEqual([]);
    expect(await tablesMentioning(dataSource, [ben.id])).toEqual(benTablesBefore);
    expect(await tombstones(dataSource)).toEqual([{ userId: ann.id }]);
  });

  test('erases the data of an expired tombstone before it forgets the tombstone', async ({
    dataSource,
    mediaRoot,
    recorder,
    purge,
    signIn,
    arrangeLeftovers,
    deleteAccount,
  }) => {
    const old = await signIn();
    const recent = await signIn();
    const ben = await signIn();
    await deleteAccount(old, { password: FACTORY_USER_PASSWORD });
    await deleteAccount(recent, { password: FACTORY_USER_PASSWORD });
    await dataSource.query(
      `UPDATE auth.deleted_accounts SET deleted_at = now() - interval '31 days' WHERE user_id = $1`,
      [old.id],
    );
    await dataSource.query('INSERT INTO profiles.profiles (user_id, handle) VALUES ($1, $2)', [
      ben.id,
      'ben.reader',
    ]);
    const neverErased = await arrangeLeftovers(old.id, ben.id);
    recorder.clear();

    const report = await purge();

    expect(report).toStrictEqual({
      replayed: 2,
      mediaFilesDeleted: 0,
      mediaFilesFailed: 0,
      forgotten: 1,
    });
    expect(recorder.all().map(({ event }) => event.payload)).toEqual(
      expect.arrayContaining([{ userId: old.id }, { userId: recent.id }]),
    );
    expect(await tablesMentioning(dataSource, neverErased.needles)).toEqual([]);
    expect(filesOf(await storedFiles(mediaRoot), neverErased.mediaIds)).toEqual([]);
    expect(await tombstones(dataSource)).toEqual([{ userId: recent.id }]);
  });

  test('walks every tombstone page', async ({ dataSource, recorder, purge }) => {
    await dataSource.query(
      'INSERT INTO auth.deleted_accounts (user_id) SELECT gen_random_uuid() FROM generate_series(1, 230)',
    );
    recorder.clear();

    const report = await purge();
    const published = recorder
      .all()
      .map(({ event }) => (event.payload as { userId: string }).userId);

    expect(report.replayed).toBe(230);
    expect(new Set(published).size).toBe(230);
    expect(published).toEqual((await tombstones(dataSource)).map(({ userId }) => userId));
  });

  test('runs as the accounts:purge-deleted command', async ({
    dataSource,
    factories,
    mediaRoot,
    signIn,
    arrangeLeftovers,
    deleteAccount,
  }) => {
    const ann = await signIn();
    const ben = await signIn();
    await factories
      .get<ProfileEntity, ProfileFactoryMeta>(ProfileEntity)
      .setMeta({ userId: ben.id })
      .save();
    await deleteAccount(ann, { password: FACTORY_USER_PASSWORD });
    const leftovers = await arrangeLeftovers(ann.id, ben.id);

    const { exitCode, output } = await runPurgeCommand();

    expect(exitCode).toBe(0);
    expect(output).toContain('Published UserDeleted again for 1 deleted accounts');
    expect(await tablesMentioning(dataSource, leftovers.needles)).toEqual([]);
    expect(filesOf(await storedFiles(mediaRoot), leftovers.mediaIds)).toEqual([]);
  });

  test('keeps photo files whose deletion failed pending, exits non-zero, and deletes them on a later run', async ({
    dataSource,
    mediaRoot,
    arrangeAccount,
    deleteAccount,
  }) => {
    const ann = await arrangeAccount();
    const [mediaId = ''] = ann.mediaIds;
    const directory = join(mediaRoot, mediaId);
    await chmod(directory, READ_ONLY);
    onTestFinished(async () => {
      await chmod(directory, WRITABLE).catch(() => undefined);
    });

    await deleteAccount(ann, { password: FACTORY_USER_PASSWORD });
    const pendingAfterDeletion = await pendingFileDeletions(dataSource);
    const failedRun = await runPurgeCommand();
    const pendingAfterFailedRun = await pendingFileDeletions(dataSource);
    await chmod(directory, WRITABLE);
    const recoveredRun = await runPurgeCommand();

    expect(pendingAfterDeletion.map(({ storageKey }) => storageKey)).toEqual([
      `${mediaId}/large.webp`,
      `${mediaId}/medium.webp`,
      `${mediaId}/small.webp`,
    ]);
    expect(pendingAfterDeletion.map(({ attempts }) => attempts)).toEqual([1, 1, 1]);
    expect(pendingAfterDeletion.every(({ lastError }) => lastError?.includes('EACCES'))).toBe(true);
    expect(failedRun.exitCode).toBe(1);
    expect(failedRun.output).toContain('3 pending media file deletions failed again');
    expect(pendingAfterFailedRun.map(({ attempts }) => attempts)).toEqual([3, 3, 3]);
    expect(recoveredRun.exitCode).toBe(0);
    expect(await pendingFileDeletions(dataSource)).toEqual([]);
    expect(filesOf(await storedFiles(mediaRoot), ann.mediaIds)).toEqual([]);
    expect(await tablesMentioning(dataSource, [ann.id, mediaId])).toEqual([]);
  });
});
