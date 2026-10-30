import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { describe, expect, vi } from 'vitest';
import type { MediaFileFactoryMeta } from '../../../src/modules/media/factories/media-file.factory.js';
import type { MediaResponse } from '../../../src/modules/media/http/media.response.js';
import { MediaFileEntity } from '../../../src/modules/media/persistence/media-file.entity.js';
import type { ReviewResponse } from '../../../src/modules/reviews/http/review.response.js';
import { expectedPhoto, fetchFile, pathOf, uploadPhoto } from '../media/media.fixture.js';
import {
  arrangeReview,
  codeOf,
  errorsOf,
  readerReviewsRoute,
  reviewRoute,
  test,
  workReviewsRoute,
  type Reviewer,
} from './reviews.fixture.js';

interface StoredPhotoRow {
  readonly photoMediaId: string | null;
}

function storedPhotos(dataSource: DataSource): Promise<StoredPhotoRow[]> {
  return dataSource.query<StoredPhotoRow[]>(
    'SELECT photo_media_id AS "photoMediaId" FROM reviews.reviews ORDER BY created_at',
  );
}

function deletePhoto(
  http: Parameters<typeof uploadPhoto>[0],
  reviewer: Reviewer,
  photo: MediaResponse,
) {
  return http.delete(`/v1/media/${photo.id}`).set('Authorization', reviewer.authorization);
}

describe('photo of the finished book', () => {
  test('writes a review with one of the own photos', async ({ http, reviewer, dataSource }) => {
    const reading = await reviewer.finishedReading();
    const photo = await uploadPhoto(http, reviewer);

    const review = await reviewer.review(reading.id, { rating: 5, photoId: photo.id });

    expect(review.photo).toStrictEqual(expectedPhoto(photo));
    expect((await reviewer.get(reviewRoute(reading.id))).body).toStrictEqual(review);
    expect(await storedPhotos(dataSource)).toEqual([{ photoMediaId: photo.id }]);
  });

  test('accepts a photo id in upper case', async ({ http, reviewer }) => {
    const reading = await reviewer.finishedReading();
    const photo = await uploadPhoto(http, reviewer);

    const review = await reviewer.review(reading.id, {
      rating: 4,
      photoId: photo.id.toUpperCase(),
    });

    expect(review.photo?.mediaId).toBe(photo.id);
  });

  test('replaces the photo and removes it when a replacement leaves it out or sends null', async ({
    http,
    reviewer,
    dataSource,
  }) => {
    const reading = await reviewer.finishedReading();
    const first = await uploadPhoto(http, reviewer);
    const second = await uploadPhoto(http, reviewer);
    await reviewer.review(reading.id, { rating: 4, photoId: first.id });

    const replaced = await reviewer.review(reading.id, { rating: 4, photoId: second.id });
    const leftOut = await reviewer.review(reading.id, { rating: 4, text: 'Still good' });
    await reviewer.review(reading.id, { rating: 4, photoId: first.id });
    const nulled = await reviewer.review(reading.id, { rating: 4, photoId: null });

    expect(replaced.photo?.mediaId).toBe(second.id);
    expect(leftOut.photo).toBeNull();
    expect(nulled.photo).toBeNull();
    expect(await storedPhotos(dataSource)).toEqual([{ photoMediaId: null }]);
  });

  test('answers 404 media_not_found for a photo of another user and keeps the review', async ({
    http,
    reviewer,
    newReviewer,
    dataSource,
  }) => {
    const other = await newReviewer();
    const reading = await reviewer.finishedReading();
    const mine = await uploadPhoto(http, reviewer);
    const theirs = await uploadPhoto(http, other);
    const before = await reviewer.review(reading.id, { rating: 3, photoId: mine.id });

    const response = await reviewer.write(reading.id, { rating: 5, photoId: theirs.id });

    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: `No media with id ${theirs.id} was found.`,
      instance: reviewRoute(reading.id),
      code: 'media_not_found',
    });
    expect((await reviewer.get(reviewRoute(reading.id))).body).toStrictEqual({
      ...before,
      photo: expectedPhoto(mine),
    });
    expect(await storedPhotos(dataSource)).toEqual([{ photoMediaId: mine.id }]);
  });

  test('answers 404 media_not_found for an unknown photo and stores nothing', async ({
    reviewer,
    dataSource,
    recorder,
  }) => {
    const reading = await reviewer.finishedReading();

    const response = await reviewer.write(reading.id, { rating: 5, photoId: randomUUID() });

    expect([response.status, codeOf(response.body)]).toEqual([404, 'media_not_found']);
    expect(await storedPhotos(dataSource)).toEqual([]);
    expect(recorder.all()).toEqual([]);
  });

  test('checks the reading before the photo', async ({ http, reviewer, newReviewer }) => {
    const other = await newReviewer();
    const theirReading = await other.finishedReading();
    const theirPhoto = await uploadPhoto(http, other);

    const response = await reviewer.write(theirReading.id, { rating: 5, photoId: theirPhoto.id });

    expect([response.status, codeOf(response.body)]).toEqual([404, 'reading_not_found']);
  });

  test('rejects a photo id that is not a UUID', async ({ reviewer }) => {
    const reading = await reviewer.finishedReading();

    const response = await reviewer.write(reading.id, { rating: 5, photoId: 'photo' });

    expect(response.status).toBe(400);
    expect(errorsOf(response.body)?.map(({ path }) => path)).toEqual(['photoId']);
  });

  test('shows the photo to a follower through a working signed URL, never to anyone else', async ({
    http,
    reviewer,
    newReviewer,
  }) => {
    const follower = await newReviewer();
    const stranger = await newReviewer();
    await follower.follows(reviewer);
    const reading = await reviewer.finishedReading();
    const photo = await uploadPhoto(http, reviewer);
    await reviewer.review(reading.id, { rating: 5, photoId: photo.id });

    const seen = await follower.get(reviewRoute(reading.id));
    const listed = await follower.page(workReviewsRoute(reading.workId));
    const file = await fetchFile(
      http,
      pathOf((seen.body as ReviewResponse).photo?.variants.large.url ?? ''),
    );
    const hidden = await stranger.get(reviewRoute(reading.id));
    const strangersList = await stranger.page(readerReviewsRoute(reviewer.id));

    expect((seen.body as ReviewResponse).photo).toStrictEqual(expectedPhoto(photo));
    expect(listed.items.map((review) => review.photo)).toStrictEqual([expectedPhoto(photo)]);
    expect([file.status, file.headers['content-type']]).toEqual([200, 'image/webp']);
    expect([hidden.status, codeOf(hidden.body)]).toEqual([404, 'review_not_found']);
    expect(strangersList.items).toEqual([]);
  });

  test('answers photo null once the photo was deleted', async ({ http, reviewer, newReviewer }) => {
    const follower = await newReviewer();
    await follower.follows(reviewer);
    const reading = await reviewer.finishedReading();
    const photo = await uploadPhoto(http, reviewer);
    await reviewer.review(reading.id, { rating: 5, photoId: photo.id });

    const deleted = await deletePhoto(http, reviewer, photo);
    const own = await reviewer.get(reviewRoute(reading.id));
    const listed = await follower.page(readerReviewsRoute(reviewer.id));

    expect(deleted.status).toBe(204);
    expect([own.status, (own.body as ReviewResponse).photo]).toEqual([200, null]);
    expect(listed.items.map((review) => review.photo)).toEqual([null]);
  });

  test('costs one media call for a page of 50 reviews with photos, like a page of one', async ({
    reviewer,
    newReviewer,
    factories,
    dataSource,
  }) => {
    const follower = await newReviewer();
    await follower.follows(reviewer);
    const media = factories.get<MediaFileEntity, MediaFileFactoryMeta>(MediaFileEntity);
    const photoIds: string[] = [];
    for (let made = 0; made < 50; made += 1) {
      const reading = await reviewer.finishedReading();
      const photo = await media.setMeta({ ownerId: reviewer.id }).save();
      await arrangeReview(factories, {
        readingId: reading.id,
        userId: reviewer.id,
        workId: reading.workId,
        photoMediaId: photo.id,
        createdAt: new Date(Date.UTC(2026, 9, 1, 0, made)),
      });
      photoIds.unshift(photo.id);
    }
    const queries = vi.spyOn(dataSource.logger, 'logQuery');
    const countQueries = async (limit: number): Promise<number> => {
      queries.mockClear();
      const page = await follower.page(`${readerReviewsRoute(reviewer.id)}?limit=${String(limit)}`);
      expect(page.items.map((review) => review.photo?.mediaId)).toEqual(photoIds.slice(0, limit));

      return queries.mock.calls.length;
    };

    const one = await countQueries(1);
    const fifty = await countQueries(50);
    queries.mockRestore();

    expect(fifty).toBe(one);
  });
});
