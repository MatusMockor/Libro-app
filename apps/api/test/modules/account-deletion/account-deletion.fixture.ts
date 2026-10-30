import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import type { Agent, Test } from 'supertest';
import type { DataSource } from 'typeorm';
import type { SeederFactoryManager } from 'typeorm-extension';
import { expect } from 'vitest';
import {
  purgeDeletedAccounts,
  type DeletedAccountsPurgeReport,
} from '../../../src/cli/deleted-accounts-purge.js';
import type { Env } from '../../../src/config/env.schema.js';
import { TASK_SCHEDULER } from '../../../src/modules/auth/application/task-scheduler.js';
import type { IdentityFactoryMeta } from '../../../src/modules/auth/factories/identity.factory.js';
import {
  DELETED_ACCOUNTS_PURGE,
  type DeletedAccountsPurge,
} from '../../../src/modules/auth/index.js';
import { IdentityEntity } from '../../../src/modules/auth/persistence/identity.entity.js';
import { WorkEntity } from '../../../src/modules/books/persistence/work.entity.js';
import type { CongratulationFactoryMeta } from '../../../src/modules/encouragements/factories/congratulation.factory.js';
import type { InsightFactoryMeta } from '../../../src/modules/encouragements/factories/insight.factory.js';
import { CongratulationEntity } from '../../../src/modules/encouragements/persistence/congratulation.entity.js';
import { InsightEntity } from '../../../src/modules/encouragements/persistence/insight.entity.js';
import type { ActivityFactoryMeta } from '../../../src/modules/feed/factories/activity.factory.js';
import type { LikeFactoryMeta } from '../../../src/modules/feed/factories/like.factory.js';
import type { PostFactoryMeta } from '../../../src/modules/feed/factories/post.factory.js';
import type { ReactionFactoryMeta } from '../../../src/modules/feed/factories/reaction.factory.js';
import type { PostResponse } from '../../../src/modules/feed/http/post.response.js';
import { ActivityEntity } from '../../../src/modules/feed/persistence/activity.entity.js';
import { LikeEntity } from '../../../src/modules/feed/persistence/like.entity.js';
import { PostEntity } from '../../../src/modules/feed/persistence/post.entity.js';
import { ReactionEntity } from '../../../src/modules/feed/persistence/reaction.entity.js';
import type { MediaFileFactoryMeta } from '../../../src/modules/media/factories/media-file.factory.js';
import type { MediaResponse } from '../../../src/modules/media/http/media.response.js';
import { MEDIA_FILE_DELETIONS, type MediaFileDeletions } from '../../../src/modules/media/index.js';
import { MediaFileEntity } from '../../../src/modules/media/persistence/media-file.entity.js';
import type { FollowFactoryMeta } from '../../../src/modules/profiles/factories/follow.factory.js';
import type { ProfileFactoryMeta } from '../../../src/modules/profiles/factories/profile.factory.js';
import { FollowEntity } from '../../../src/modules/profiles/persistence/follow.entity.js';
import { ProfileEntity } from '../../../src/modules/profiles/persistence/profile.entity.js';
import type { ReadingSessionFactoryMeta } from '../../../src/modules/reading-sessions/factories/reading-session.factory.js';
import type { ReadingFactoryMeta } from '../../../src/modules/reading-sessions/factories/reading.factory.js';
import type { SessionParticipantFactoryMeta } from '../../../src/modules/reading-sessions/factories/session-participant.factory.js';
import type { ReadingSessionResponse } from '../../../src/modules/reading-sessions/http/reading-session.response.js';
import { ReadingSessionEntity } from '../../../src/modules/reading-sessions/persistence/reading-session.entity.js';
import { ReadingEntity } from '../../../src/modules/reading-sessions/persistence/reading.entity.js';
import { SessionParticipantEntity } from '../../../src/modules/reading-sessions/persistence/session-participant.entity.js';
import type { ReviewFactoryMeta } from '../../../src/modules/reviews/factories/review.factory.js';
import { ReviewEntity } from '../../../src/modules/reviews/persistence/review.entity.js';
import { googleSignInWith, useLocalGoogleSigningKeys } from '../../support/google-sign-in.js';
import { integrationTest } from '../../support/integration-test.js';
import { ManualTaskScheduler } from '../../support/manual-task-scheduler.js';
import { ProbeAuthSubscriberModule } from '../../support/probe-events/auth/probe-auth-subscriber.module.js';
import { ProbeEventRecorder } from '../../support/probe-events/subscriber/probe-event-recorder.js';
import type { SignedInUser, SignIn } from '../../support/sign-in.js';
import { userTables } from '../../support/truncate-tables.js';
import { jpeg } from '../media/images.js';

export const DELETION_ROUTE = '/v1/me/deletion';

export const TOMBSTONE_TABLE = 'auth.deleted_accounts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface Account extends SignedInUser {
  readonly mediaIds: readonly string[];
  readonly finishedReadingId: string;
  readonly openReadingId: string;
  readonly readingIds: readonly string[];
  readonly sessionIds: readonly string[];
  readonly authSessionIds: readonly string[];
  readonly postIds: readonly string[];
}

export type ArrangeAccount = (user?: SignedInUser) => Promise<Account>;

export type DeleteAccount = (user: { readonly authorization: string }, body: object) => Test;

export type Purge = () => Promise<DeletedAccountsPurgeReport>;

export interface Tombstone {
  readonly userId: string;
}

export interface Leftovers {
  readonly needles: readonly string[];
  readonly mediaIds: readonly string[];
}

export interface PendingFileDeletionRow {
  readonly storageKey: string;
  readonly attempts: number;
  readonly lastError: string | null;
}

function as(http: Agent, authorization: string) {
  return {
    get: (path: string) => http.get(path).set('Authorization', authorization),
    post: (path: string, body: object = {}) =>
      http.post(path).set('Authorization', authorization).send(body),
    patch: (path: string, body: object) =>
      http.patch(path).set('Authorization', authorization).send(body),
    put: (path: string, body: object = {}) =>
      http.put(path).set('Authorization', authorization).send(body),
    upload: (image: Buffer) =>
      http
        .post('/v1/media')
        .set('Authorization', authorization)
        .attach('file', image, { filename: 'photo.jpg', contentType: 'image/jpeg' }),
  };
}

function expectStatus(response: { status: number }, status: number, step: string): void {
  expect(response.status, step).toBe(status);
}

async function readBook(
  http: Agent,
  authorization: string,
  workId: string,
  photoId: string | null,
): Promise<ReadingSessionResponse> {
  const user = as(http, authorization);
  const started = await user.post('/v1/reading-sessions', { workId, place: 'Kaviaren Libro' });
  expectStatus(started, 201, 'start session');
  const session = started.body as ReadingSessionResponse;
  const route = `/v1/reading-sessions/${session.id}`;

  expectStatus(await user.post(`${route}/checkpoints`, { page: 12 }), 201, 'checkpoint');
  expectStatus(
    await user.post(`${route}/marked-parts`, { kind: 'good', fromPage: 3, toPage: 9 }),
    201,
    'marked part',
  );
  if (photoId === null) {
    return session;
  }

  expectStatus(await user.post(`${route}/end`), 200, 'end session');
  expectStatus(await user.post(`/v1/readings/${session.readingId}/finish`), 200, 'finish');
  expectStatus(await user.get(`/v1/readings/${session.readingId}/tree`), 200, 'tree');
  expectStatus(
    await user.put(`/v1/readings/${session.readingId}/review`, {
      rating: 4,
      text: 'Kafka on a tram',
      photoId,
    }),
    200,
    'review',
  );

  return session;
}

async function arrangeGroupReading(
  http: Agent,
  factories: SeederFactoryManager,
  authorization: string,
  hostSessionId: string,
): Promise<void> {
  expectStatus(
    await as(http, authorization).put('/v1/me/reading-privacy').send({ liveSessions: 'followers' }),
    200,
    'reading privacy',
  );
  const companion = await factories
    .get<ReadingSessionEntity, ReadingSessionFactoryMeta>(ReadingSessionEntity)
    .setMeta({})
    .save();
  await factories
    .get<SessionParticipantEntity, SessionParticipantFactoryMeta>(SessionParticipantEntity)
    .setMeta({ hostSessionId, participantSessionId: companion.id })
    .save();
}

async function authSessionIdsOf(dataSource: DataSource, userId: string): Promise<string[]> {
  const rows = await dataSource.query<{ id: string }[]>(
    'SELECT id FROM auth.sessions WHERE user_id = $1 ORDER BY id',
    [userId],
  );

  return rows.map(({ id }) => id);
}

function arrangeAccountWith(
  http: Agent,
  dataSource: DataSource,
  factories: SeederFactoryManager,
  signIn: SignIn,
): ArrangeAccount {
  return async (signedIn) => {
    const user = signedIn ?? (await signIn());
    const client = as(http, user.authorization);
    const [finishedWork, openWork] = [
      await factories.get(WorkEntity).save(),
      await factories.get(WorkEntity).save(),
    ];

    const uploaded = await client.upload(await jpeg({ width: 64, height: 48 }));
    expectStatus(uploaded, 201, 'upload');
    const media = uploaded.body as MediaResponse;
    expectStatus(
      await client.patch('/v1/me/profile', {
        displayName: 'Ann Reader',
        bio: 'Reads Kafka on trams',
        favouriteGenres: ['classics', 'poetry'],
        topBookIds: [finishedWork.id],
        avatarMediaId: media.id,
      }),
      200,
      'profile',
    );
    const finished = await readBook(http, user.authorization, finishedWork.id, media.id);
    const open = await readBook(http, user.authorization, openWork.id, null);
    const posted = await client.post('/v1/posts', {
      text: 'Finished Kafka on the tram',
      workId: finishedWork.id,
      place: 'Kaviaren Libro',
      photoIds: [media.id],
    });
    expectStatus(posted, 201, 'post');
    await arrangeGroupReading(http, factories, user.authorization, open.id);
    await factories
      .get<IdentityEntity, IdentityFactoryMeta>(IdentityEntity)
      .setMeta({ userId: user.id })
      .save();

    return {
      ...user,
      mediaIds: [media.id],
      finishedReadingId: finished.readingId,
      openReadingId: open.readingId,
      readingIds: [finished.readingId, open.readingId],
      sessionIds: [finished.id, open.id],
      authSessionIds: await authSessionIdsOf(dataSource, user.id),
      postIds: [(posted.body as PostResponse).id],
    };
  };
}

export async function follows(
  http: Agent,
  follower: { readonly authorization: string },
  ...followees: readonly { readonly id: string }[]
): Promise<void> {
  for (const followee of followees) {
    const response = await as(http, follower.authorization).put(
      `/v1/profiles/${followee.id}/follow`,
    );
    expectStatus(response, 204, `follow ${followee.id}`);
  }
}

export async function engagesWith(
  http: Agent,
  reader: { readonly authorization: string },
  ...authors: readonly { readonly postIds: readonly string[] }[]
): Promise<void> {
  const client = as(http, reader.authorization);
  for (const postId of authors.flatMap(({ postIds }) => postIds)) {
    expectStatus(await client.put(`/v1/posts/${postId}/like`), 204, `like ${postId}`);
    expectStatus(await client.put(`/v1/posts/${postId}/reactions/books`), 204, `react ${postId}`);
  }
}

export async function encourages(
  http: Agent,
  author: { readonly authorization: string },
  ...readers: readonly Pick<Account, 'finishedReadingId' | 'openReadingId'>[]
): Promise<void> {
  const client = as(http, author.authorization);
  for (const { finishedReadingId, openReadingId } of readers) {
    expectStatus(
      await client.post(`/v1/readings/${openReadingId}/insights`, { text: 'Keep going' }),
      201,
      `insight on ${openReadingId}`,
    );
    expectStatus(
      await client.put(`/v1/readings/${finishedReadingId}/congratulation`),
      204,
      `congratulate on ${finishedReadingId}`,
    );
  }
}

export function needlesOf(account: Account): string[] {
  return [
    account.id,
    account.email,
    ...account.mediaIds,
    ...account.readingIds,
    ...account.sessionIds,
    ...account.authSessionIds,
    ...account.postIds,
  ];
}

function representationsOf(needles: readonly string[]): string[] {
  return [
    ...new Set(
      needles.flatMap((needle) => {
        const lower = needle.toLowerCase();

        return UUID.test(lower) ? [lower, lower.replaceAll('-', '')] : [lower];
      }),
    ),
  ];
}

export async function tablesMentioning(
  dataSource: DataSource,
  needles: readonly string[],
): Promise<string[]> {
  const mentioning: string[] = [];
  for (const table of await userTables(dataSource, [TOMBSTONE_TABLE])) {
    const [row] = await dataSource.query<[{ found: boolean }]>(
      `SELECT EXISTS (
         SELECT 1 FROM ${table} AS stored
         WHERE EXISTS (
           SELECT 1 FROM unnest($1::text[]) AS needle
           WHERE strpos(lower(stored::text), needle) > 0
         )
       ) AS found`,
      [representationsOf(needles)],
    );
    if (row.found) {
      mentioning.push(table);
    }
  }

  return mentioning;
}

export async function rowCounts(dataSource: DataSource): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of await userTables(dataSource, [])) {
    const [row] = await dataSource.query<[{ count: number }]>(
      `SELECT count(*)::int AS count FROM ${table}`,
    );
    counts[table] = row.count;
  }

  return counts;
}

export function tombstones(dataSource: DataSource): Promise<Tombstone[]> {
  return dataSource.query<Tombstone[]>(
    `SELECT user_id AS "userId" FROM ${TOMBSTONE_TABLE} ORDER BY user_id`,
  );
}

export function pendingFileDeletions(dataSource: DataSource): Promise<PendingFileDeletionRow[]> {
  return dataSource.query<PendingFileDeletionRow[]>(
    `SELECT storage_key AS "storageKey", attempts, last_error AS "lastError"
     FROM media.pending_file_deletions ORDER BY storage_key`,
  );
}

export async function storedFiles(mediaRoot: string): Promise<string[]> {
  const entries = await readdir(mediaRoot, { recursive: true, withFileTypes: true }).catch(
    () => [],
  );

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => resolve(entry.parentPath, entry.name).slice(mediaRoot.length + 1))
    .sort();
}

export function filesOf(files: readonly string[], mediaIds: readonly string[]): string[] {
  return files.filter((file) => mediaIds.some((mediaId) => file.startsWith(`${mediaId}/`)));
}

export async function arrangeLeftovers(
  dataSource: DataSource,
  factories: SeederFactoryManager,
  mediaRoot: string,
  userId: string,
  followeeId: string,
): Promise<Leftovers> {
  const work = await factories.get(WorkEntity).save();
  await factories
    .get<ProfileEntity, ProfileFactoryMeta>(ProfileEntity)
    .setMeta({ userId, handle: 'left.over', topBookIds: [work.id] })
    .save();
  await factories
    .get<FollowEntity, FollowFactoryMeta>(FollowEntity)
    .setMeta({ followerId: userId, followeeId })
    .save();
  await factories
    .get<FollowEntity, FollowFactoryMeta>(FollowEntity)
    .setMeta({ followerId: followeeId, followeeId: userId })
    .save();
  const reading = await factories
    .get<ReadingEntity, ReadingFactoryMeta>(ReadingEntity)
    .setMeta({ userId, workId: work.id })
    .save();
  const session = await factories
    .get<ReadingSessionEntity, ReadingSessionFactoryMeta>(ReadingSessionEntity)
    .setMeta({ reading, status: 'ended', checkpointPages: [5] })
    .save();
  await dataSource.query(
    'INSERT INTO tree.finished_trees (reading_id, user_id, tree_engine_version) VALUES ($1, $2, 1)',
    [reading.id, userId],
  );
  await dataSource.query(
    `INSERT INTO reading.sharing_settings (user_id, live_sessions) VALUES ($1, 'nobody')`,
    [userId],
  );
  const companion = await factories
    .get<ReadingSessionEntity, ReadingSessionFactoryMeta>(ReadingSessionEntity)
    .setMeta({ status: 'ended' })
    .save();
  await factories
    .get<SessionParticipantEntity, SessionParticipantFactoryMeta>(SessionParticipantEntity)
    .setMeta({ hostSessionId: session.id, participantSessionId: companion.id })
    .save();
  const media = await factories
    .get<MediaFileEntity, MediaFileFactoryMeta>(MediaFileEntity)
    .setMeta({ ownerId: userId })
    .save();
  await factories
    .get<ReviewEntity, ReviewFactoryMeta>(ReviewEntity)
    .setMeta({ readingId: reading.id, userId, workId: work.id, photoMediaId: media.id })
    .save();
  await mkdir(join(mediaRoot, media.id), { recursive: true });
  await writeFile(join(mediaRoot, media.id, 'small.webp'), 'left over');
  const post = await factories
    .get<PostEntity, PostFactoryMeta>(PostEntity)
    .setMeta({ authorId: userId, workId: work.id, photoIds: [media.id] })
    .save();
  for (const kind of ['reading_started', 'book_finished'] as const) {
    await factories
      .get<ActivityEntity, ActivityFactoryMeta>(ActivityEntity)
      .setMeta({ actorId: userId, kind, readingId: reading.id, workId: work.id })
      .save();
  }
  const followeePost = await factories
    .get<PostEntity, PostFactoryMeta>(PostEntity)
    .setMeta({ authorId: followeeId })
    .save();
  await factories
    .get<LikeEntity, LikeFactoryMeta>(LikeEntity)
    .setMeta({ postId: followeePost.id, userId })
    .save();
  await factories
    .get<ReactionEntity, ReactionFactoryMeta>(ReactionEntity)
    .setMeta({ postId: followeePost.id, userId, reaction: 'hug' })
    .save();
  await factories
    .get<InsightEntity, InsightFactoryMeta>(InsightEntity)
    .setMeta({ readingId: reading.id, readerId: userId, authorId: followeeId })
    .save();
  await factories
    .get<CongratulationEntity, CongratulationFactoryMeta>(CongratulationEntity)
    .setMeta({ readerId: followeeId, authorId: userId })
    .save();

  return {
    needles: [userId, reading.id, session.id, media.id, post.id],
    mediaIds: [media.id],
  };
}

function purgeOf(app: INestApplication): Purge {
  return () =>
    purgeDeletedAccounts({
      accounts: app.get<DeletedAccountsPurge>(DELETED_ACCOUNTS_PURGE),
      mediaFiles: app.get<MediaFileDeletions>(MEDIA_FILE_DELETIONS),
    });
}

const scheduler = new ManualTaskScheduler();

export const test = integrationTest({
  imports: [ProbeAuthSubscriberModule],
  configure: (builder) =>
    useLocalGoogleSigningKeys(builder).overrideProvider(TASK_SCHEDULER).useValue(scheduler),
})
  .extend('mediaRoot', { scope: 'file' }, ({ app }) =>
    resolve(app.get<ConfigService<Env, true>>(ConfigService).get('MEDIA_LOCAL_ROOT')),
  )
  .extend('emptyMediaRoot', { auto: true }, async ({ mediaRoot }) => {
    await rm(mediaRoot, { recursive: true, force: true });
  })
  .extend('scheduler', { auto: true }, () => {
    scheduler.clear();

    return scheduler;
  })
  .extend('recorder', ({ app }) => {
    const recorder = app.get(ProbeEventRecorder);
    recorder.clear();

    return recorder;
  })
  .extend('google', ({ http }) => googleSignInWith(http))
  .extend('purge', ({ app }) => purgeOf(app))
  .extend('arrangeAccount', ({ http, dataSource, factories, signIn }) =>
    arrangeAccountWith(http, dataSource, factories, signIn),
  )
  .extend(
    'arrangeLeftovers',
    ({ dataSource, factories, mediaRoot }) =>
      (userId: string, followeeId: string) =>
        arrangeLeftovers(dataSource, factories, mediaRoot, userId, followeeId),
  )
  .extend(
    'deleteAccount',
    ({ http }): DeleteAccount =>
      ({ authorization }, body) =>
        http.post(DELETION_ROUTE).set('Authorization', authorization).send(body),
  );
