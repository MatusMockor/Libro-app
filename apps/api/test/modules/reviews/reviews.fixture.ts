import type { Agent, Test } from 'supertest';
import type { DataSource } from 'typeorm';
import type { SeederFactoryManager } from 'typeorm-extension';
import { expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type { WorkFactoryMeta } from '../../../src/modules/books/factories/work.factory.js';
import { WorkEntity } from '../../../src/modules/books/persistence/work.entity.js';
import type { ProfileFactoryMeta } from '../../../src/modules/profiles/factories/profile.factory.js';
import { ProfileEntity } from '../../../src/modules/profiles/persistence/profile.entity.js';
import type { ReadingFactoryMeta } from '../../../src/modules/reading-sessions/factories/reading.factory.js';
import { ReadingEntity } from '../../../src/modules/reading-sessions/persistence/reading.entity.js';
import type { ReviewFactoryMeta } from '../../../src/modules/reviews/factories/review.factory.js';
import type {
  ReviewPageResponse,
  ReviewResponse,
} from '../../../src/modules/reviews/http/review.response.js';
import { ReviewEntity } from '../../../src/modules/reviews/persistence/review.entity.js';
import { integrationTest } from '../../support/integration-test.js';
import { ProbeReviewsSubscriberModule } from '../../support/probe-events/reviews/probe-reviews-subscriber.module.js';
import { ProbeEventRecorder } from '../../support/probe-events/subscriber/probe-event-recorder.js';
import type { SignIn } from '../../support/sign-in.js';

export const STARTED_AT = new Date('2026-01-01T08:00:00.000Z');

export const FINISHED_AT = new Date('2026-10-20T18:30:00.000Z');

export const reviewRoute = (readingId: string): string => `/v1/readings/${readingId}/review`;

export const readerReviewsRoute = (userId: string): string => `/v1/profiles/${userId}/reviews`;

export const workReviewsRoute = (workId: string): string => `/v1/books/${workId}/reviews`;

export interface Reviewer {
  readonly id: string;
  readonly authorization: string;
  get(path: string): Test;
  delete(path: string): Test;
  write(readingId: string, body: object): Test;
  review(readingId: string, body?: object): Promise<ReviewResponse>;
  page(path: string): Promise<ReviewPageResponse>;
  finishedReading(meta?: Omit<ReadingFactoryMeta, 'userId'>): Promise<ReadingEntity>;
  follows(...reviewers: readonly { readonly id: string }[]): Promise<void>;
  unfollows(reviewer: { readonly id: string }): Promise<void>;
}

export type NewReviewer = (profile?: ProfileFactoryMeta) => Promise<Reviewer>;

export interface StoredReviewRow {
  readonly readingId: string;
  readonly userId: string;
  readonly workId: string;
  readonly rating: number;
  readonly text: string | null;
}

export function codeOf(body: unknown): string | undefined {
  return (body as ProblemDetails).code;
}

export function errorsOf(body: unknown): { path: string; code: string }[] | undefined {
  return (body as ProblemDetails).errors?.map(({ path, code }) => ({ path, code }));
}

export function readingIdsOf({ items }: ReviewPageResponse): string[] {
  return items.map(({ readingId }) => readingId);
}

function reviewerOf(
  http: Agent,
  factories: SeederFactoryManager,
  { id, authorization }: { id: string; authorization: string },
): Reviewer {
  const reviewer: Reviewer = {
    id,
    authorization,
    get: (path) => http.get(path).set('Authorization', authorization),
    delete: (path) => http.delete(path).set('Authorization', authorization),
    write: (readingId, body) =>
      http.put(reviewRoute(readingId)).set('Authorization', authorization).send(body),
    review: async (readingId, body = { rating: 4, text: 'Worth every page' }) => {
      const response = await reviewer.write(readingId, body);
      expect(response.status, `PUT ${reviewRoute(readingId)}`).toBe(200);

      return response.body as ReviewResponse;
    },
    page: async (path) => {
      const response = await reviewer.get(path);
      expect(response.status, `GET ${path}`).toBe(200);

      return response.body as ReviewPageResponse;
    },
    finishedReading: async (meta = {}) => {
      const workId = meta.workId ?? (await factories.get(WorkEntity).save()).id;

      return arrangeFinishedReading(factories, id, workId, meta);
    },
    follows: async (...followees) => {
      for (const followee of followees) {
        const response = await http
          .put(`/v1/profiles/${followee.id}/follow`)
          .set('Authorization', authorization);
        expect(response.status, `follow ${followee.id}`).toBe(204);
      }
    },
    unfollows: async (followee) => {
      const response = await http
        .delete(`/v1/profiles/${followee.id}/follow`)
        .set('Authorization', authorization);
      expect(response.status, `unfollow ${followee.id}`).toBe(204);
    },
  };

  return reviewer;
}

function newReviewerWith(
  http: Agent,
  factories: SeederFactoryManager,
  signIn: SignIn,
): NewReviewer {
  return async (profile = {}) => {
    const user = await signIn();
    await factories
      .get<ProfileEntity, ProfileFactoryMeta>(ProfileEntity)
      .setMeta({ ...profile, userId: user.id })
      .save();

    return reviewerOf(http, factories, user);
  };
}

export function arrangeWork(
  factories: SeederFactoryManager,
  meta: WorkFactoryMeta = {},
): Promise<WorkEntity> {
  return factories.get<WorkEntity, WorkFactoryMeta>(WorkEntity).setMeta(meta).save();
}

export function arrangeFinishedReading(
  factories: SeederFactoryManager,
  userId: string,
  workId: string,
  meta: Omit<ReadingFactoryMeta, 'userId' | 'workId'> = {},
): Promise<ReadingEntity> {
  return factories
    .get<ReadingEntity, ReadingFactoryMeta>(ReadingEntity)
    .setMeta({ startedAt: STARTED_AT, finishedAt: FINISHED_AT, ...meta, userId, workId })
    .save();
}

export function arrangeReview(
  factories: SeederFactoryManager,
  meta: ReviewFactoryMeta,
): Promise<ReviewEntity> {
  return factories.get<ReviewEntity, ReviewFactoryMeta>(ReviewEntity).setMeta(meta).save();
}

export function storedReviews(dataSource: DataSource): Promise<StoredReviewRow[]> {
  return dataSource.query<StoredReviewRow[]>(
    `SELECT reading_id AS "readingId", user_id AS "userId", work_id AS "workId", rating, text
     FROM reviews.reviews
     ORDER BY created_at, reading_id`,
  );
}

export const test = integrationTest({ imports: [ProbeReviewsSubscriberModule] })
  .extend('recorder', ({ app }) => {
    const recorder = app.get(ProbeEventRecorder);
    recorder.clear();

    return recorder;
  })
  .extend('newReviewer', ({ http, factories, signIn }) => newReviewerWith(http, factories, signIn))
  .extend('reviewer', ({ newReviewer }) => newReviewer());
