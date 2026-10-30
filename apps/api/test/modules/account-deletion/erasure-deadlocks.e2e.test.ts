import { ConsoleLogger } from '@nestjs/common';
import type { DataSource, QueryRunner } from 'typeorm';
import type { SeederFactoryManager } from 'typeorm-extension';
import { describe, expect, onTestFinished } from 'vitest';
import { retryOnDeadlock } from '../../../src/database/deadlock.js';
import { EVENT_BUS, type EventBus } from '../../../src/events/event-bus.js';
import { UserDeleted } from '../../../src/modules/auth/index.js';
import type { LikeFactoryMeta } from '../../../src/modules/feed/factories/like.factory.js';
import type { PostFactoryMeta } from '../../../src/modules/feed/factories/post.factory.js';
import { LikeEntity } from '../../../src/modules/feed/persistence/like.entity.js';
import { PostEntity } from '../../../src/modules/feed/persistence/post.entity.js';
import type { FollowFactoryMeta } from '../../../src/modules/profiles/factories/follow.factory.js';
import type { ProfileFactoryMeta } from '../../../src/modules/profiles/factories/profile.factory.js';
import { FollowEntity } from '../../../src/modules/profiles/persistence/follow.entity.js';
import { ProfileEntity } from '../../../src/modules/profiles/persistence/profile.entity.js';
import { CapturingLogger } from '../../support/capturing-logger.js';
import { test as base } from '../../support/integration-test.js';
import { requestsWaitingForSessionLock } from '../../support/session-lock.js';

const ANN = '00000000-0000-4000-8000-0000000000a1';

const BEN = '00000000-0000-4000-8000-0000000000b2';

const BLOCKER_DEADLOCK_TIMEOUT = '10s';

const test = base.extend('logger', ({ app }) => {
  const logger = new CapturingLogger();
  app.useLogger(logger);
  onTestFinished(() => {
    app.useLogger(new ConsoleLogger());
  });

  return logger;
});

async function blockerHolding(dataSource: DataSource, sql: string, userId: string) {
  const connection: QueryRunner = dataSource.createQueryRunner();
  await connection.connect();
  await connection.startTransaction();
  await connection.query(`SET LOCAL deadlock_timeout = '${BLOCKER_DEADLOCK_TIMEOUT}'`);
  await connection.query(sql, [userId]);

  return {
    query: (next: string, parameters: unknown[]) => connection.query(next, parameters),
    commit: async () => {
      await connection.commitTransaction();
      await connection.release();
    },
  };
}

async function arrangeMutualLikes(factories: SeederFactoryManager): Promise<void> {
  const posts = factories.get<PostEntity, PostFactoryMeta>(PostEntity);
  const likes = factories.get<LikeEntity, LikeFactoryMeta>(LikeEntity);
  const annsPost = await posts.save({ authorId: ANN });
  const bensPost = await posts.save({ authorId: BEN });
  await likes.save({ postId: annsPost.id, userId: BEN });
  await likes.save({ postId: bensPost.id, userId: ANN });
}

async function arrangeMutualFollows(factories: SeederFactoryManager): Promise<void> {
  const profiles = factories.get<ProfileEntity, ProfileFactoryMeta>(ProfileEntity);
  const follows = factories.get<FollowEntity, FollowFactoryMeta>(FollowEntity);
  await profiles.save({ userId: ANN });
  await profiles.save({ userId: BEN });
  await follows.save({ followerId: ANN, followeeId: BEN });
  await follows.save({ followerId: BEN, followeeId: ANN });
}

async function rowsOf(dataSource: DataSource, sql: string): Promise<unknown[]> {
  return dataSource.query<unknown[]>(sql);
}

describe('erasure handlers retry a deadlock', () => {
  test('erases the feed of a user whose erasure deadlocked with the erasure of a mutual liker', async ({
    app,
    dataSource,
    factories,
    logger,
  }) => {
    await arrangeMutualLikes(factories);
    const blocker = await blockerHolding(
      dataSource,
      'DELETE FROM feed.likes WHERE user_id = $1',
      BEN,
    );

    const erasure = app.get<EventBus>(EVENT_BUS).publish(UserDeleted.create({ userId: ANN }));
    const waiting = await requestsWaitingForSessionLock(dataSource, 1, '%DELETE FROM feed.posts%');
    const crossed = await blocker
      .query('DELETE FROM feed.likes WHERE user_id = $1', [ANN])
      .then(() => 'blocker survived');
    await blocker.commit();
    await erasure;

    expect(waiting).toBe(1);
    expect(crossed).toBe('blocker survived');
    expect(logger.errors).toEqual([]);
    expect(await rowsOf(dataSource, 'SELECT author_id AS "authorId" FROM feed.posts')).toEqual([
      { authorId: BEN },
    ]);
    expect(await rowsOf(dataSource, 'SELECT 1 FROM feed.likes')).toEqual([]);
  });

  test('erases the profile of a user whose erasure deadlocked with the erasure of a mutual follower', async ({
    app,
    dataSource,
    factories,
    logger,
  }) => {
    await arrangeMutualFollows(factories);
    const blocker = await blockerHolding(
      dataSource,
      'DELETE FROM profiles.follows WHERE follower_id = $1',
      BEN,
    );

    const erasure = app.get<EventBus>(EVENT_BUS).publish(UserDeleted.create({ userId: ANN }));
    const waiting = await requestsWaitingForSessionLock(
      dataSource,
      1,
      '%DELETE FROM profiles.profiles%',
    );
    const crossed = await blocker
      .query('DELETE FROM profiles.follows WHERE follower_id = $1', [ANN])
      .then(() => 'blocker survived');
    await blocker.commit();
    await erasure;

    expect(waiting).toBe(1);
    expect(crossed).toBe('blocker survived');
    expect(logger.errors).toEqual([]);
    expect(await rowsOf(dataSource, 'SELECT user_id AS "userId" FROM profiles.profiles')).toEqual([
      { userId: BEN },
    ]);
    expect(await rowsOf(dataSource, 'SELECT 1 FROM profiles.follows')).toEqual([]);
  });
});

describe('retryOnDeadlock', () => {
  test('runs the work again after a real deadlock and answers its result', async ({
    dataSource,
    factories,
  }) => {
    await arrangeMutualLikes(factories);
    const blocker = await blockerHolding(
      dataSource,
      'DELETE FROM feed.likes WHERE user_id = $1',
      BEN,
    );
    let attempts = 0;
    const attempt = () => {
      attempts += 1;

      return dataSource.transaction(async (manager) => {
        await manager.query('DELETE FROM feed.likes WHERE user_id = $1', [ANN]);
        await manager.query('DELETE FROM feed.likes WHERE user_id = $1', [BEN]);

        return 'done';
      });
    };

    const work = retryOnDeadlock(3, attempt);
    await requestsWaitingForSessionLock(dataSource, 1, '%DELETE FROM feed.likes%');
    await blocker.query('DELETE FROM feed.likes WHERE user_id = $1', [ANN]);
    await blocker.commit();

    expect(await work).toBe('done');
    expect(attempts).toBe(2);
  });

  test('passes any other error on without a retry', async ({ dataSource }) => {
    let calls = 0;
    const failing = retryOnDeadlock(3, () => {
      calls += 1;

      return dataSource.query('SELECT 1 / 0');
    });

    await expect(failing).rejects.toThrow('division by zero');
    expect(calls).toBe(1);
  });
});
