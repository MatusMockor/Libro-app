import type { Agent } from 'supertest';
import type { SeederFactoryManager } from 'typeorm-extension';
import { expect } from 'vitest';
import type { ActivityFactoryMeta } from '../../../src/modules/feed/factories/activity.factory.js';
import type {
  ActivityPageResponse,
  ActivityResponse,
} from '../../../src/modules/feed/http/activity.response.js';
import { ActivityEntity } from '../../../src/modules/feed/persistence/activity.entity.js';
import type { MediaFileFactoryMeta } from '../../../src/modules/media/factories/media-file.factory.js';
import { MediaFileEntity } from '../../../src/modules/media/persistence/media-file.entity.js';
import type { ReadingActivityAudience } from '../../../src/modules/reading-sessions/domain/reading-privacy.js';
import type { ReadingSessionResponse } from '../../../src/modules/reading-sessions/http/reading-session.response.js';
import type { ReviewFactoryMeta } from '../../../src/modules/reviews/factories/review.factory.js';
import { ReviewEntity } from '../../../src/modules/reviews/persistence/review.entity.js';
import { arrangeWork, test as base, type Reader } from './feed.fixture.js';

export const ACTIVITY_ROUTE = '/v1/feed/activity';

export interface Readings {
  start(reader: Reader, workId: string): Promise<ReadingSessionResponse>;
  join(reader: Reader, sessionId: string): Promise<ReadingSessionResponse>;
  end(reader: Reader, sessionId: string): Promise<void>;
  finish(reader: Reader, readingId: string): Promise<void>;
  read(reader: Reader, workId: string): Promise<ReadingSessionResponse>;
  review(reader: Reader, readingId: string, body: object): Promise<void>;
  shareReadingActivity(reader: Reader, readingActivity: ReadingActivityAudience): Promise<void>;
}

function readingsOf(http: Agent): Readings {
  const send = async (
    reader: Reader,
    method: 'post' | 'put',
    path: string,
    status: number,
    body: object = {},
  ): Promise<unknown> => {
    const response = await http[method](path).set('Authorization', reader.authorization).send(body);
    expect(response.status, `${method} ${path} ${JSON.stringify(response.body)}`).toBe(status);

    return response.body;
  };
  const readings: Readings = {
    start: async (reader, workId) =>
      (await send(reader, 'post', '/v1/reading-sessions', 201, {
        workId,
      })) as ReadingSessionResponse,
    join: async (reader, sessionId) =>
      (await send(
        reader,
        'post',
        `/v1/reading-sessions/${sessionId}/join`,
        201,
      )) as ReadingSessionResponse,
    end: async (reader, sessionId) => {
      await send(reader, 'post', `/v1/reading-sessions/${sessionId}/end`, 200);
    },
    finish: async (reader, readingId) => {
      await send(reader, 'post', `/v1/readings/${readingId}/finish`, 200);
    },
    read: async (reader, workId) => {
      const session = await readings.start(reader, workId);
      await readings.end(reader, session.id);
      await readings.finish(reader, session.readingId);

      return session;
    },
    review: async (reader, readingId, body) => {
      await send(reader, 'put', `/v1/readings/${readingId}/review`, 200, body);
    },
    shareReadingActivity: async (reader, readingActivity) => {
      await send(reader, 'put', '/v1/me/reading-privacy', 200, { readingActivity });
    },
  };

  return readings;
}

export async function activityPage(reader: Reader, query = ''): Promise<ActivityPageResponse> {
  const path = `${ACTIVITY_ROUTE}${query === '' ? '' : `?${query}`}`;
  const response = await reader.get(path);
  expect(response.status, `${path} ${JSON.stringify(response.body)}`).toBe(200);

  return response.body as ActivityPageResponse;
}

export async function everyActivity(
  reader: Reader,
  query: string,
  limit: number,
): Promise<ActivityResponse[]> {
  const seen: ActivityResponse[] = [];
  let cursor: string | null = null;
  for (let pages = 0; pages < 50; pages += 1) {
    const after: string = cursor === null ? '' : `&cursor=${cursor}`;
    const page = await activityPage(reader, `${query}&limit=${String(limit)}${after}`);
    seen.push(...page.items);
    cursor = page.nextCursor;
    if (cursor === null) {
      return seen;
    }
  }

  return seen;
}

export function kindsOf({ items }: ActivityPageResponse): string[] {
  return items.map(({ kind }) => kind);
}

export function arrangeActivity(
  factories: SeederFactoryManager,
  meta: ActivityFactoryMeta,
): Promise<ActivityEntity> {
  return factories.get<ActivityEntity, ActivityFactoryMeta>(ActivityEntity).setMeta(meta).save();
}

export function arrangeReview(
  factories: SeederFactoryManager,
  meta: ReviewFactoryMeta,
): Promise<ReviewEntity> {
  return factories.get<ReviewEntity, ReviewFactoryMeta>(ReviewEntity).setMeta(meta).save();
}

export async function arrangePhoto(
  factories: SeederFactoryManager,
  ownerId: string,
): Promise<string> {
  const media = await factories
    .get<MediaFileEntity, MediaFileFactoryMeta>(MediaFileEntity)
    .setMeta({ ownerId })
    .save();

  return media.id;
}

export const test = base
  .extend('readings', ({ http }) => readingsOf(http))
  .extend('work', ({ factories }) =>
    arrangeWork(factories, { title: 'Proces', authors: ['Franz Kafka'] }),
  );
