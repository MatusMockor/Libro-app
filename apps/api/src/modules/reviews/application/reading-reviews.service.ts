import { Inject, Injectable } from '@nestjs/common';
import { distinctIdBatch } from '../../../shared/id-batch.js';
import {
  MAX_READING_REVIEWS_PER_CALL,
  type ReadingReview,
  type ReadingReviews,
} from '../reading-reviews.js';
import { REVIEW_REPOSITORY, type ReviewRepository } from './review-repository.js';

@Injectable()
export class ReadingReviewsService implements ReadingReviews {
  constructor(@Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepository) {}

  async findForReadings(
    readingIds: readonly string[],
  ): Promise<ReadonlyMap<string, ReadingReview>> {
    const distinct = distinctIdBatch(readingIds, MAX_READING_REVIEWS_PER_CALL);
    if (distinct.length === 0) {
      return new Map();
    }

    const found = await this.reviews.findByReadingIds(distinct);

    return new Map(
      found.map(({ readingId, rating, text, photoMediaId }) => [
        readingId,
        { readingId, rating, text, photoMediaId },
      ]),
    );
  }
}
