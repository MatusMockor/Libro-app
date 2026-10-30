import { ConsoleLogger } from '@nestjs/common';
import type { DataSource, QueryRunner } from 'typeorm';
import type { SeederFactoryManager } from 'typeorm-extension';
import { describe, expect, onTestFinished } from 'vitest';
import { retryOnDeadlock } from '../../../src/database/deadlock.js';
import { EVENT_BUS, type EventBus } from '../../../src/events/event-bus.js';
import { UserDeleted } from '../../../src/modules/auth/index.js';
import type { CongratulationFactoryMeta } from '../../../src/modules/encouragements/factories/congratulation.factory.js';
import type { InsightFactoryMeta } from '../../../src/modules/encouragements/factories/insight.factory.js';
import { CongratulationEntity } from '../../../src/modules/encouragements/persistence/congratulation.entity.js';
import { InsightEntity } from '../../../src/modules/encouragements/persistence/insight.entity.js';
import type { LikeFactoryMeta } from '../../../src/modules/feed/factories/like.factory.js';
import type { PostFactoryMeta } from '../../../src/modules/feed/factories/post.factory.js';
import { LikeEntity } from '../../../src/modules/feed/persistence/like.entity.js';
import { PostEntity } from '../../../src/modules/feed/persistence/post.entity.js';
import type { FollowFactoryMeta } from '../../../src/modules/profiles/factories/follow.factory.js';
import type { ProfileFactoryMeta } from '../../../src/modules/profiles/factories/profile.factory.js';
import { FollowEntity } from '../../../src/modules/profiles/persistence/follow.entity.js';
import { ProfileEntity } from '../../../src/modules/profiles/persistence/profile.entity.js';
import type { ReadingSessionFactoryMeta } from '../../../src/modules/reading-sessions/factories/reading-session.factory.js';
import type { ReadingFactoryMeta } from '../../../src/modules/reading-sessions/factories/reading.factory.js';
import type { SessionParticipantFactoryMeta } from '../../../src/modules/reading-sessions/factories/session-participant.factory.js';
import { ReadingSessionEntity } from '../../../src/modules/reading-sessions/persistence/reading-session.entity.js';
import { ReadingEntity } from '../../../src/modules/reading-sessions/persistence/reading.entity.js';
import { SessionParticipantEntity } from '../../../src/modules/reading-sessions/persistence/session-participant.entity.js';
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

async function endedSessionOf(
  factories: SeederFactoryManager,
  userId: string,
): Promise<ReadingSessionEntity> {
  const reading = await factories
    .get<ReadingEntity, ReadingFactoryMeta>(ReadingEntity)
    .save({ userId });

  return factories
    .get<ReadingSessionEntity, ReadingSessionFactoryMeta>(ReadingSessionEntity)
    .setMeta({ reading, status: 'ended' })
    .save();
}

async function arrangeMutualGroups(factories: SeederFactoryManager): Promise<void> {
  const participations = factories.get<SessionParticipantEntity, SessionParticipantFactoryMeta>(
    SessionParticipantEntity,
  );
  const [annHosting, benJoining] = [
    await endedSessionOf(factories, ANN),
    await endedSessionOf(factories, BEN),
  ];
  const [benHosting, annJoining] = [
    await endedSessionOf(factories, BEN),
    await endedSessionOf(factories, ANN),
  ];
  await participations.save({
    hostSessionId: annHosting.id,
    participantSessionId: benJoining.id,
  });
  await participations.save({
    hostSessionId: benHosting.id,
    participantSessionId: annJoining.id,
  });
}

async function arrangeMutualEncouragements(factories: SeederFactoryManager): Promise<void> {
  const insights = factories.get<InsightEntity, InsightFactoryMeta>(InsightEntity);
  const congratulations = factories.get<CongratulationEntity, CongratulationFactoryMeta>(
    CongratulationEntity,
  );
  for (const [readerId, authorId] of [
    [ANN, BEN],
    [BEN, ANN],
  ] as const) {
    await insights.save({ readerId, authorId });
    await congratulations.save({ readerId, authorId });
  }
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

describe('reading erasure and deadlocks', () => {
  test('erases the readings of a user whose erasure deadlocked with the erasure of a group partner', async ({
    app,
    dataSource,
    factories,
    logger,
  }) => {
    await arrangeMutualGroups(factories);
    const blocker = await blockerHolding(
      dataSource,
      'DELETE FROM reading.sessions WHERE user_id = $1',
      BEN,
    );

    const erasure = app.get<EventBus>(EVENT_BUS).publish(UserDeleted.create({ userId: ANN }));
    const waiting = await requestsWaitingForSessionLock(
      dataSource,
      1,
      '%DELETE FROM reading.readings%',
    );
    const crossed = await blocker
      .query('DELETE FROM reading.sessions WHERE user_id = $1', [ANN])
      .then(() => 'blocker survived');
    await blocker.commit();
    await erasure;

    expect(waiting).toBe(1);
    expect(crossed).toBe('blocker survived');
    expect(logger.errors).toEqual([]);
    expect(await rowsOf(dataSource, 'SELECT user_id AS "userId" FROM reading.readings')).toEqual([
      { userId: BEN },
      { userId: BEN },
    ]);
    expect(await rowsOf(dataSource, 'SELECT 1 FROM reading.sessions')).toEqual([]);
    expect(await rowsOf(dataSource, 'SELECT 1 FROM reading.session_participants')).toEqual([]);
  });
});

describe('encouragement erasure and deadlocks', () => {
  test('erases the encouragements of a user whose erasure deadlocked with the erasure of a mutual encourager', async ({
    app,
    dataSource,
    factories,
    logger,
  }) => {
    await arrangeMutualEncouragements(factories);
    const blocker = await blockerHolding(
      dataSource,
      'DELETE FROM encouragements.congratulations WHERE author_id = $1 OR reader_id = $1',
      BEN,
    );

    const erasure = app.get<EventBus>(EVENT_BUS).publish(UserDeleted.create({ userId: ANN }));
    const waiting = await requestsWaitingForSessionLock(
      dataSource,
      1,
      '%DELETE FROM encouragements.congratulations%',
    );
    const crossed = await blocker
      .query('DELETE FROM encouragements.insights WHERE author_id = $1 OR reader_id = $1', [BEN])
      .then(() => 'blocker survived');
    await blocker.commit();
    await erasure;

    expect(waiting).toBe(1);
    expect(crossed).toBe('blocker survived');
    expect(logger.errors).toEqual([]);
    expect(await rowsOf(dataSource, 'SELECT 1 FROM encouragements.insights')).toEqual([]);
    expect(await rowsOf(dataSource, 'SELECT 1 FROM encouragements.congratulations')).toEqual([]);
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
