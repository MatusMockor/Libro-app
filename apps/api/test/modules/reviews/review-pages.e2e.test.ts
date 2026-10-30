import { randomUUID } from 'node:crypto';
import { describe, expect, vi } from 'vitest';
import type { ReviewPageResponse } from '../../../src/modules/reviews/http/review.response.js';
import {
  arrangeReview,
  codeOf,
  errorsOf,
  readerReviewsRoute,
  readingIdsOf,
  test,
  workReviewsRoute,
  type Reviewer,
} from './reviews.fixture.js';

const SAME_TIME = new Date('2026-10-21T08:00:00.000Z');

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function cursorOf(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

async function allPages(reviewer: Reviewer, route: string, limit: number): Promise<string[][]> {
  const pages: string[][] = [];
  let cursor: string | null = null;
  for (let round = 0; round < 20; round += 1) {
    const query: string = cursor === null ? '' : `&cursor=${cursor}`;
    const page: ReviewPageResponse = await reviewer.page(`${route}?limit=${String(limit)}${query}`);
    pages.push(readingIdsOf(page));
    cursor = page.nextCursor;
    if (cursor === null) {
      return pages;
    }
  }

  return pages;
}

async function reviewedReadings(reviewer: Reviewer, count: number, workId?: string) {
  const readingIds: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const reading = await reviewer.finishedReading(workId === undefined ? {} : { workId });
    await reviewer.review(reading.id, { rating: (index % 5) + 1 });
    readingIds.push(reading.id);
  }

  return readingIds;
}

const routes = [
  ['GET /v1/profiles/:userId/reviews', (reviewer: Reviewer) => readerReviewsRoute(reviewer.id)],
  ['GET /v1/books/:workId/reviews', (_: Reviewer, workId: string) => workReviewsRoute(workId)],
] as const;

describe.for(routes)('%s', ([, routeOf]) => {
  test('pages newest first with the cursor, without repeating or skipping', async ({
    reviewer,
  }) => {
    const workId = randomUUID();
    const readingIds = await reviewedReadings(reviewer, 5, workId);

    const pages = await allPages(reviewer, routeOf(reviewer, workId), 2);

    expect(pages).toEqual([
      [readingIds[4], readingIds[3]],
      [readingIds[2], readingIds[1]],
      [readingIds[0]],
    ]);
  });

  test('orders reviews created at the same time by reading id', async ({ reviewer, factories }) => {
    const workId = randomUUID();
    const readingIds = [randomUUID(), randomUUID(), randomUUID()];
    for (const readingId of readingIds) {
      await arrangeReview(factories, {
        readingId,
        userId: reviewer.id,
        workId,
        createdAt: SAME_TIME,
        updatedAt: SAME_TIME,
      });
    }

    const pages = await allPages(reviewer, routeOf(reviewer, workId), 1);

    expect(pages.flat()).toEqual(readingIds.toSorted().toReversed());
  });

  test('keeps microsecond precision in the cursor', async ({ reviewer, factories, dataSource }) => {
    const workId = randomUUID();
    const readingIds = [randomUUID(), randomUUID()];
    for (const readingId of readingIds) {
      await arrangeReview(factories, { readingId, userId: reviewer.id, workId });
    }
    await dataSource.query(
      `UPDATE reviews.reviews
       SET created_at = $2::timestamptz + make_interval(secs => 0.000001 * (reading_id = $1)::int)`,
      [readingIds[0], SAME_TIME],
    );

    const pages = await allPages(reviewer, routeOf(reviewer, workId), 1);

    expect(pages).toEqual([[readingIds[0]], [readingIds[1]]]);
  });

  test('answers 400 validation_failed for page limits', async ({ reviewer }) => {
    const route = routeOf(reviewer, randomUUID());

    for (const [query, code] of [
      ['limit=0', 'too_small'],
      ['limit=51', 'too_big'],
      ['limit=2.5', 'invalid_type'],
    ] as const) {
      const response = await reviewer.get(`${route}?${query}`);
      expect(response.status, query).toBe(400);
      expect(errorsOf(response.body), query).toEqual([{ path: 'limit', code }]);
    }
  });

  test.for([
    'cursor=',
    'cursor=nonsense',
    `cursor=${cursorOf({ createdAt: '2026-02-30T10:00:00.000000Z', readingId: randomUUID() })}`,
    `cursor=${cursorOf({ createdAt: '2026-10-01T10:00:00.000Z', readingId: randomUUID() })}`,
    `cursor=${cursorOf({ createdAt: '2026-10-01T10:00:00.000000Z', readingId: 'jana' })}`,
    `cursor=${cursorOf({ createdAt: '2026-10-01T10:00:00.000000Z' })}`,
    `cursor=${cursorOf({ createdAt: '2026-10-01T10:00:00.000000Z', id: randomUUID() })}`,
    `cursor=${cursorOf({ createdAt: '2026-10-01T10:00:00.000000Z', readingId: randomUUID(), more: 1 })}`,
    `cursor=${cursorOf(['2026-10-01T10:00:00.000000Z', randomUUID()])}`,
    `cursor=${Buffer.from('{"createdAt":').toString('base64url')}`,
  ])('answers 400 validation_failed for %s', async (query, { reviewer }) => {
    const response = await reviewer.get(`${routeOf(reviewer, randomUUID())}?${query}`);

    expect(response.status).toBe(400);
    expect(codeOf(response.body)).toBe('validation_failed');
    expect(errorsOf(response.body)?.map(({ path }) => path)).toEqual(['cursor']);
  });

  test('answers 400 validation_failed for a cursor that is not encoded canonically', async ({
    reviewer,
  }) => {
    const route = routeOf(reviewer, randomUUID());
    const json = `${JSON.stringify({ createdAt: '2026-10-01T10:00:00.000000Z', readingId: randomUUID() })} `;
    const canonical = Buffer.from(json).toString('base64url');
    const last = BASE64URL_ALPHABET.indexOf(canonical.slice(-1));
    const nonCanonical = `${canonical.slice(0, -1)}${BASE64URL_ALPHABET.charAt(last ^ 1)}`;

    const accepted = await reviewer.get(`${route}?cursor=${canonical}`);
    const rejected = await reviewer.get(`${route}?cursor=${nonCanonical}`);
    const padded = await reviewer.get(`${route}?cursor=${canonical}%3D`);
    const appended = await reviewer.get(`${route}?cursor=${canonical}!`);

    expect(Buffer.from(nonCanonical, 'base64url').toString()).toBe(json);
    expect([accepted.status, rejected.status, padded.status, appended.status]).toEqual([
      200, 400, 400, 400,
    ]);
    for (const response of [rejected, padded, appended]) {
      expect(errorsOf(response.body)?.map(({ path }) => path)).toEqual(['cursor']);
    }
  });

  test('costs the same number of queries for one review or fifty', async ({
    reviewer,
    newReviewer,
    dataSource,
  }) => {
    const workId = randomUUID();
    await reviewedReadings(reviewer, 50, workId);
    const follower = await newReviewer();
    await follower.follows(reviewer);
    const route = routeOf(reviewer, workId);
    const queries = vi.spyOn(dataSource.logger, 'logQuery');
    const countQueries = async (limit: number): Promise<number> => {
      queries.mockClear();
      const page = await follower.page(`${route}?limit=${String(limit)}`);
      expect(page.items).toHaveLength(limit);

      return queries.mock.calls.length;
    };

    const one = await countQueries(1);
    const fifty = await countQueries(50);
    queries.mockRestore();

    expect(fifty).toBe(one);
  });
});

describe('GET /v1/books/:workId/reviews', () => {
  test('accepts a cursor of a profile list', async ({ reviewer }) => {
    const workId = randomUUID();
    const readingIds = await reviewedReadings(reviewer, 2, workId);
    const first = await reviewer.page(`${readerReviewsRoute(reviewer.id)}?limit=1`);

    const second = await reviewer.page(
      `${workReviewsRoute(workId)}?limit=1&cursor=${first.nextCursor ?? ''}`,
    );

    expect(readingIdsOf(second)).toEqual([readingIds[0]]);
  });
});
