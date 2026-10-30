import { randomUUID } from 'node:crypto';
import { describe, expect } from 'vitest';
import {
  MAX_READING_REVIEWS_PER_CALL,
  READING_REVIEWS,
  type ReadingReviews,
} from '../../../src/modules/reviews/index.js';
import { arrangeReview, arrangeWork, test as base } from './reviews.fixture.js';

const test = base.extend('readingReviews', { scope: 'file' }, ({ app }) =>
  app.get<ReadingReviews>(READING_REVIEWS),
);

describe('READING_REVIEWS public interface', () => {
  test('answers the reviews of the given readings, whoever wrote them', async ({
    readingReviews,
    factories,
    reviewer,
  }) => {
    const work = await arrangeWork(factories);
    const withPhoto = await arrangeReview(factories, {
      userId: reviewer.id,
      workId: work.id,
      rating: 5,
      text: 'Skvelá',
      photoMediaId: randomUUID(),
    });
    const plain = await arrangeReview(factories, { workId: work.id, rating: 3, text: null });
    await arrangeReview(factories, { workId: work.id });

    const found = await readingReviews.findForReadings([
      withPhoto.readingId,
      plain.readingId,
      plain.readingId,
      randomUUID(),
    ]);

    expect(Object.fromEntries(found)).toStrictEqual({
      [withPhoto.readingId]: {
        readingId: withPhoto.readingId,
        rating: 5,
        text: 'Skvelá',
        photoMediaId: withPhoto.photoMediaId,
      },
      [plain.readingId]: { readingId: plain.readingId, rating: 3, text: null, photoMediaId: null },
    });
  });

  test('answers an empty map for no readings', async ({ readingReviews }) => {
    expect((await readingReviews.findForReadings([])).size).toBe(0);
  });

  test(`refuses more than ${String(MAX_READING_REVIEWS_PER_CALL)} distinct readings`, async ({
    readingReviews,
  }) => {
    const readingIds = Array.from({ length: MAX_READING_REVIEWS_PER_CALL + 1 }, () => randomUUID());

    await expect(readingReviews.findForReadings(readingIds)).rejects.toThrow(RangeError);
  });
});
