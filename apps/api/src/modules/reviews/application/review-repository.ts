import type { ReviewPageQuery } from '../domain/review-page.js';
import type { NewReview, SavedReview, StoredReview } from '../domain/review.js';

export const REVIEW_REPOSITORY = Symbol('REVIEW_REPOSITORY');

export interface ReviewRepository {
  save(review: NewReview): Promise<SavedReview | undefined>;
  findVisible(readingId: string, readerIds: readonly string[]): Promise<StoredReview | undefined>;
  findByReadingIds(readingIds: readonly string[]): Promise<StoredReview[]>;
  deleteOwned(userId: string, readingId: string): Promise<boolean>;
  listByReader(userId: string, page: ReviewPageQuery): Promise<StoredReview[]>;
  listByWork(
    workId: string,
    readerIds: readonly string[],
    page: ReviewPageQuery,
  ): Promise<StoredReview[]>;
  deleteAllOf(userId: string): Promise<void>;
}
