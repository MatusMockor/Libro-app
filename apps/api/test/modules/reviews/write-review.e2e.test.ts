import { randomUUID } from 'node:crypto';
import { describe, expect } from 'vitest';
import type { BookResponse } from '../../../src/modules/books/http/book.response.js';
import type { ReviewResponse } from '../../../src/modules/reviews/http/review.response.js';
import {
  arrangeWork,
  codeOf,
  errorsOf,
  FINISHED_AT,
  readingIdsOf,
  reviewRoute,
  storedReviews,
  test,
  workReviewsRoute,
} from './reviews.fixture.js';

const FIRST_STAR = 1;
const LAST_STAR = 5;
const COMBINING_ACUTE = '́';

describe('PUT /v1/readings/:readingId/review', () => {
  test('creates the review of a finished reading and answers it', async ({
    reviewer,
    factories,
  }) => {
    const work = await arrangeWork(factories, { title: 'Proces', authors: ['Franz Kafka'] });
    const reading = await reviewer.finishedReading({ workId: work.id });
    const book = (await reviewer.get(`/v1/books/${work.id}`)).body as BookResponse;

    const response = await reviewer.write(reading.id, { rating: 5, text: 'Read it twice' });
    const review = response.body as ReviewResponse;

    expect(response.status).toBe(200);
    expect(review).toStrictEqual({
      readingId: reading.id,
      readerId: reviewer.id,
      reader: expect.objectContaining({ userId: reviewer.id, followedByMe: false }) as unknown,
      book: {
        id: work.id,
        title: 'Proces',
        authors: book.authors.map(({ id, name }) => ({ id, name })),
      },
      rating: 5,
      text: 'Read it twice',
      finishedAt: FINISHED_AT.toISOString(),
      createdAt: expect.any(String) as unknown,
      updatedAt: review.createdAt,
      photo: null,
    });
    expect(review.book?.authors.map(({ name }) => name)).toEqual(['Franz Kafka']);
  });

  test('replaces the review, keeps when it was created and stores one row', async ({
    reviewer,
    dataSource,
  }) => {
    const reading = await reviewer.finishedReading();
    const created = await reviewer.review(reading.id, { rating: 2, text: 'Slow start' });

    const replaced = await reviewer.review(reading.id, { rating: 4, text: 'Grew on me' });

    expect(replaced).toMatchObject({ rating: 4, text: 'Grew on me' });
    expect(replaced.createdAt).toBe(created.createdAt);
    expect(Date.parse(replaced.updatedAt)).toBeGreaterThan(Date.parse(created.updatedAt));
    expect(await storedReviews(dataSource)).toEqual([
      {
        readingId: reading.id,
        userId: reviewer.id,
        workId: reading.workId,
        rating: 4,
        text: 'Grew on me',
      },
    ]);
  });

  test('removes the text when a replacement leaves it out', async ({ reviewer }) => {
    const reading = await reviewer.finishedReading();
    await reviewer.review(reading.id, { rating: 3, text: 'Some thoughts' });

    const replaced = await reviewer.review(reading.id, { rating: 3 });

    expect(replaced.text).toBeNull();
  });

  test.for([
    ['left out', {}],
    ['null', { text: null }],
    ['empty', { text: '' }],
    ['blank', { text: ' \n\t ' }],
  ] as const)('stores no text when it is %s', async ([, text], { reviewer, dataSource }) => {
    const reading = await reviewer.finishedReading();

    const review = await reviewer.review(reading.id, { rating: 3, ...text });

    expect(review.text).toBeNull();
    expect((await storedReviews(dataSource)).map((row) => row.text)).toEqual([null]);
  });

  test('trims the text and normalises it to NFC', async ({ reviewer }) => {
    const reading = await reviewer.finishedReading();

    const review = await reviewer.review(reading.id, {
      rating: 4,
      text: `  Kra${COMBINING_ACUTE}sna kniha  `,
    });

    expect(review.text).toBe('Krásna kniha');
  });

  test('accepts 1000 characters counted in Unicode code points', async ({ reviewer }) => {
    const reading = await reviewer.finishedReading();
    const text = '📚'.repeat(1000);

    const review = await reviewer.review(reading.id, { rating: 4, text });

    expect(review.text).toBe(text);
  });

  test('counts the length after trimming and NFC normalisation', async ({ reviewer }) => {
    const reading = await reviewer.finishedReading();

    const review = await reviewer.review(reading.id, {
      rating: 4,
      text: `  ${`e${COMBINING_ACUTE}`.repeat(1000)}  `,
    });

    expect(review.text).toBe('é'.repeat(1000));
  });

  test('answers 400 validation_failed for 1001 characters', async ({ reviewer, dataSource }) => {
    const reading = await reviewer.finishedReading();

    const response = await reviewer.write(reading.id, { rating: 4, text: '📚'.repeat(1001) });

    expect(response.status).toBe(400);
    expect(codeOf(response.body)).toBe('validation_failed');
    expect(errorsOf(response.body)).toEqual([{ path: 'text', code: 'too_big' }]);
    expect(await storedReviews(dataSource)).toEqual([]);
  });

  test.for([FIRST_STAR, 2, 3, 4, LAST_STAR])('accepts %i stars', async (rating, { reviewer }) => {
    const reading = await reviewer.finishedReading();

    expect((await reviewer.review(reading.id, { rating })).rating).toBe(rating);
  });

  test.for([
    ['0 stars', { rating: 0 }, 'too_small'],
    ['6 stars', { rating: 6 }, 'too_big'],
    ['half a star', { rating: 2.5 }, 'invalid_type'],
    ['a rating as text', { rating: '3' }, 'invalid_type'],
    ['no rating', { text: 'Fine' }, 'invalid_type'],
    ['a text that is not a string', { rating: 3, text: 42 }, 'invalid_type'],
  ] as const)(
    'answers 400 validation_failed for %s',
    async ([, body, code], { reviewer, dataSource }) => {
      const reading = await reviewer.finishedReading();

      const response = await reviewer.write(reading.id, body);

      expect(response.status).toBe(400);
      expect(codeOf(response.body)).toBe('validation_failed');
      expect(errorsOf(response.body)?.map((error) => error.code)).toEqual([code]);
      expect(await storedReviews(dataSource)).toEqual([]);
    },
  );

  test('answers 400 validation_failed for a reading id that is not a UUID', async ({
    reviewer,
  }) => {
    const response = await reviewer.write('nonsense', { rating: 3 });

    expect(response.status).toBe(400);
    expect(errorsOf(response.body)).toEqual([{ path: 'readingId', code: 'invalid_format' }]);
  });

  test('answers 409 reading_not_finished for a reading in progress', async ({
    reviewer,
    dataSource,
  }) => {
    const reading = await reviewer.finishedReading({ finishedAt: null });

    const response = await reviewer.write(reading.id, { rating: 3 });

    expect(response.status).toBe(409);
    expect(codeOf(response.body)).toBe('reading_not_finished');
    expect(await storedReviews(dataSource)).toEqual([]);
  });

  test('answers 404 reading_not_found for an unknown reading', async ({ reviewer }) => {
    const response = await reviewer.write(randomUUID(), { rating: 3 });

    expect(response.status).toBe(404);
    expect(codeOf(response.body)).toBe('reading_not_found');
  });

  test("answers 404 reading_not_found for another reader's reading, also when it is reviewed", async ({
    reviewer,
    newReviewer,
    dataSource,
  }) => {
    const other = await newReviewer();
    await other.follows(reviewer);
    await reviewer.follows(other);
    const reading = await other.finishedReading();
    await other.review(reading.id, { rating: 5, text: 'Mine' });

    const response = await reviewer.write(reading.id, { rating: 1, text: 'Hijacked' });

    expect(response.status).toBe(404);
    expect(codeOf(response.body)).toBe('reading_not_found');
    expect((await storedReviews(dataSource)).map(({ rating, text }) => ({ rating, text }))).toEqual(
      [{ rating: 5, text: 'Mine' }],
    );
  });

  test('accepts the reading id in upper case', async ({ reviewer }) => {
    const reading = await reviewer.finishedReading();

    const review = await reviewer.review(reading.id.toUpperCase(), { rating: 3 });

    expect(review.readingId).toBe(reading.id);
  });

  test('gives every read-through of a book its own review', async ({ reviewer }) => {
    const first = await reviewer.finishedReading({ finishedAt: new Date('2026-01-10T10:00:00Z') });
    const reread = await reviewer.finishedReading({ workId: first.workId });
    await reviewer.review(first.id, { rating: 3, text: 'First time' });
    await reviewer.review(reread.id, { rating: 5, text: 'Better the second time' });

    const page = await reviewer.page(workReviewsRoute(first.workId));

    expect(readingIdsOf(page)).toEqual([reread.id, first.id]);
    expect(page.items.map(({ finishedAt }) => finishedAt)).toEqual([
      FINISHED_AT.toISOString(),
      '2026-01-10T10:00:00.000Z',
    ]);
  });

  test('publishes ReviewPublished v1 once, when the review is first created', async ({
    reviewer,
    recorder,
  }) => {
    const reading = await reviewer.finishedReading();

    await reviewer.review(reading.id, { rating: 2 });
    await reviewer.review(reading.id, { rating: 3 });

    expect(recorder.all()).toEqual([
      {
        handler: 'reviews.v1',
        event: expect.objectContaining({
          name: 'ReviewPublished',
          version: 1,
          payload: { readingId: reading.id, userId: reviewer.id, workId: reading.workId },
        }) as unknown,
      },
    ]);
  });

  test('creates one review and publishes once for overlapping first writes', async ({
    reviewer,
    recorder,
    dataSource,
  }) => {
    const reading = await reviewer.finishedReading();

    const responses = await Promise.all(
      [1, 2, 3, 4].map((rating) => reviewer.write(reading.id, { rating })),
    );

    expect(responses.map(({ status }) => status)).toEqual([200, 200, 200, 200]);
    expect(await storedReviews(dataSource)).toHaveLength(1);
    expect(recorder.all().map(({ event }) => event.name)).toEqual(['ReviewPublished']);
  });

  test('publishes nothing for a rejected review', async ({ reviewer, recorder }) => {
    const reading = await reviewer.finishedReading({ finishedAt: null });

    await reviewer.write(reading.id, { rating: 3 });
    await reviewer.write(randomUUID(), { rating: 3 });

    expect(recorder.all()).toEqual([]);
  });
});

describe('DELETE /v1/readings/:readingId/review', () => {
  test('deletes the own review, which is then gone', async ({ reviewer, dataSource }) => {
    const reading = await reviewer.finishedReading();
    await reviewer.review(reading.id);

    const response = await reviewer.delete(reviewRoute(reading.id));

    expect(response.status).toBe(204);
    expect(await storedReviews(dataSource)).toEqual([]);
    expect(codeOf((await reviewer.get(reviewRoute(reading.id))).body)).toBe('review_not_found');
  });

  test('lets the reading be reviewed again and publishes the new review', async ({
    reviewer,
    recorder,
  }) => {
    const reading = await reviewer.finishedReading();
    await reviewer.review(reading.id);
    await reviewer.delete(reviewRoute(reading.id));

    await reviewer.review(reading.id, { rating: 1 });

    expect(recorder.all()).toHaveLength(2);
  });

  test('answers 404 review_not_found when there is no review', async ({ reviewer }) => {
    const reading = await reviewer.finishedReading();

    const unknown = await reviewer.delete(reviewRoute(randomUUID()));
    const unreviewed = await reviewer.delete(reviewRoute(reading.id));

    expect([unknown.status, codeOf(unknown.body)]).toEqual([404, 'review_not_found']);
    expect([unreviewed.status, codeOf(unreviewed.body)]).toEqual([404, 'review_not_found']);
  });

  test("answers 404 review_not_found for another reader's review and keeps it", async ({
    reviewer,
    newReviewer,
    dataSource,
  }) => {
    const other = await newReviewer();
    await reviewer.follows(other);
    const reading = await other.finishedReading();
    await other.review(reading.id);

    const response = await reviewer.delete(reviewRoute(reading.id));

    expect(response.status).toBe(404);
    expect(codeOf(response.body)).toBe('review_not_found');
    expect(await storedReviews(dataSource)).toHaveLength(1);
  });
});

describe.for([
  ['put', reviewRoute(randomUUID())],
  ['get', reviewRoute(randomUUID())],
  ['delete', reviewRoute(randomUUID())],
  ['get', `/v1/profiles/${randomUUID()}/reviews`],
  ['get', workReviewsRoute(randomUUID())],
] as const)('%s %s', ([method, path]) => {
  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http[method](path).send({ rating: 3 });

    expect(response.status).toBe(401);
    expect(codeOf(response.body)).toBe('authentication_required');
  });
});
