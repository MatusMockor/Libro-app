import { randomUUID } from 'node:crypto';
import { describe, expect, vi } from 'vitest';
import type { ReviewResponse } from '../../../src/modules/reviews/http/review.response.js';
import {
  arrangeFinishedReading,
  arrangeWork,
  codeOf,
  readerReviewsRoute,
  readingIdsOf,
  reviewRoute,
  test,
  workReviewsRoute,
} from './reviews.fixture.js';

describe('GET /v1/readings/:readingId/review', () => {
  test('answers the own review', async ({ reviewer }) => {
    const reading = await reviewer.finishedReading();
    const written = await reviewer.review(reading.id, { rating: 4, text: 'Calm and wise' });

    const response = await reviewer.get(reviewRoute(reading.id));

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual(written);
  });

  test('answers the review to a follower of the reader', async ({ reviewer, newReviewer }) => {
    const follower = await newReviewer();
    await follower.follows(reviewer);
    const reading = await reviewer.finishedReading();
    const written = await reviewer.review(reading.id);

    const response = await follower.get(reviewRoute(reading.id));
    const review = response.body as ReviewResponse;

    expect(response.status).toBe(200);
    expect(review).toStrictEqual({
      ...written,
      reader: { ...written.reader, followedByMe: true },
    });
  });

  test('answers 404 review_not_found to a reader who does not follow, like a missing review', async ({
    reviewer,
    newReviewer,
  }) => {
    const stranger = await newReviewer();
    const followed = await newReviewer();
    await reviewer.follows(stranger);
    await stranger.follows(followed);
    const reading = await reviewer.finishedReading();
    await reviewer.review(reading.id);
    const unreviewed = await reviewer.finishedReading();

    const hidden = await stranger.get(reviewRoute(reading.id));
    const missing = await reviewer.get(reviewRoute(unreviewed.id));
    const unknown = await stranger.get(reviewRoute(randomUUID()));

    expect([hidden.status, codeOf(hidden.body)]).toEqual([404, 'review_not_found']);
    expect(hidden.body).toStrictEqual({ ...missing.body, instance: reviewRoute(reading.id) });
    expect([unknown.status, codeOf(unknown.body)]).toEqual([404, 'review_not_found']);
  });

  test('looks up a hidden review with the same queries as a missing one', async ({
    reviewer,
    newReviewer,
    dataSource,
  }) => {
    const stranger = await newReviewer();
    const reading = await reviewer.finishedReading();
    await reviewer.review(reading.id);
    const queries = vi.spyOn(dataSource.logger, 'logQuery');
    const queriesOf = async (readingId: string): Promise<string[]> => {
      queries.mockClear();
      const response = await stranger.get(reviewRoute(readingId));
      expect([response.status, codeOf(response.body)]).toEqual([404, 'review_not_found']);

      return queries.mock.calls.map(([query]) => query);
    };

    const hidden = await queriesOf(reading.id);
    const missing = await queriesOf(randomUUID());
    queries.mockRestore();

    expect(hidden).toEqual(missing);
  });

  test('hides the review again after an unfollow', async ({ reviewer, newReviewer }) => {
    const follower = await newReviewer();
    await follower.follows(reviewer);
    const reading = await reviewer.finishedReading();
    await reviewer.review(reading.id);
    await follower.unfollows(reviewer);

    const response = await follower.get(reviewRoute(reading.id));

    expect([response.status, codeOf(response.body)]).toEqual([404, 'review_not_found']);
  });

  test('shows reader null for a reader without a profile', async ({ http, signIn, factories }) => {
    const user = await signIn();
    const work = await arrangeWork(factories);
    const reading = await arrangeFinishedReading(factories, user.id, work.id);
    const written = await http
      .put(reviewRoute(reading.id))
      .set('Authorization', user.authorization)
      .send({ rating: 3 });

    const response = await http
      .get(reviewRoute(reading.id))
      .set('Authorization', user.authorization);

    expect(written.status).toBe(200);
    expect(response.body).toMatchObject({ readingId: reading.id, readerId: user.id, reader: null });
  });

  test('shows book null for a book no longer in the catalogue', async ({ reviewer }) => {
    const reading = await reviewer.finishedReading({ workId: randomUUID() });
    await reviewer.review(reading.id);

    const review = (await reviewer.get(reviewRoute(reading.id))).body as ReviewResponse;

    expect(review.book).toBeNull();
    expect(review.reader?.userId).toBe(reviewer.id);
  });
});

describe('GET /v1/profiles/:userId/reviews', () => {
  test('lists the reviews to the reader and to their followers', async ({
    reviewer,
    newReviewer,
  }) => {
    const follower = await newReviewer();
    await follower.follows(reviewer);
    const reading = await reviewer.finishedReading();
    await reviewer.review(reading.id);

    const own = await reviewer.page(readerReviewsRoute(reviewer.id));
    const followed = await follower.page(readerReviewsRoute(reviewer.id));

    expect(readingIdsOf(own)).toEqual([reading.id]);
    expect(readingIdsOf(followed)).toEqual([reading.id]);
    expect(followed.items[0]?.reader?.followedByMe).toBe(true);
  });

  test('answers an empty page to a reader who does not follow and for an unknown user', async ({
    reviewer,
    newReviewer,
  }) => {
    const stranger = await newReviewer();
    await reviewer.follows(stranger);
    const reading = await reviewer.finishedReading();
    await reviewer.review(reading.id);

    expect(await stranger.page(readerReviewsRoute(reviewer.id))).toStrictEqual({
      items: [],
      nextCursor: null,
    });
    expect(await stranger.page(readerReviewsRoute(randomUUID()))).toStrictEqual({
      items: [],
      nextCursor: null,
    });
  });

  test('lists only the reviews of that user', async ({ reviewer, newReviewer }) => {
    const other = await newReviewer();
    await reviewer.follows(other);
    const own = await reviewer.finishedReading();
    await reviewer.review(own.id);
    const theirs = await other.finishedReading({ workId: own.workId });
    await other.review(theirs.id);

    expect(readingIdsOf(await reviewer.page(readerReviewsRoute(other.id)))).toEqual([theirs.id]);
    expect(readingIdsOf(await reviewer.page(readerReviewsRoute(reviewer.id)))).toEqual([own.id]);
  });
});

describe('GET /v1/books/:workId/reviews', () => {
  test('lists the reviews of the book by me and the readers I follow, newest first', async ({
    reviewer,
    newReviewer,
  }) => {
    const followed = await newReviewer();
    const stranger = await newReviewer();
    const follower = await newReviewer();
    await reviewer.follows(followed);
    await follower.follows(reviewer);
    const own = await reviewer.finishedReading();
    const workId = own.workId;
    await reviewer.review(own.id);
    const theirs = await followed.finishedReading({ workId });
    await followed.review(theirs.id);
    const strangers = await stranger.finishedReading({ workId });
    await stranger.review(strangers.id);
    const followers = await follower.finishedReading({ workId });
    await follower.review(followers.id);
    const otherBook = await followed.finishedReading();
    await followed.review(otherBook.id);

    const page = await reviewer.page(workReviewsRoute(workId));

    expect(readingIdsOf(page)).toEqual([theirs.id, own.id]);
    expect(page.items.map(({ reader }) => reader?.followedByMe)).toEqual([true, false]);
  });

  test('answers an empty page for an unknown book or one without visible reviews', async ({
    reviewer,
  }) => {
    const reading = await reviewer.finishedReading();

    expect(await reviewer.page(workReviewsRoute(randomUUID()))).toStrictEqual({
      items: [],
      nextCursor: null,
    });
    expect(await reviewer.page(workReviewsRoute(reading.workId))).toStrictEqual({
      items: [],
      nextCursor: null,
    });
  });
});
