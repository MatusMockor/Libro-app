export const READING_REVIEWS = Symbol('READING_REVIEWS');

export const MAX_READING_REVIEWS_PER_CALL = 100;

export interface ReadingReview {
  readonly readingId: string;
  readonly rating: number;
  readonly text: string | null;
  readonly photoMediaId: string | null;
}

export interface ReadingReviews {
  findForReadings(readingIds: readonly string[]): Promise<ReadonlyMap<string, ReadingReview>>;
}
