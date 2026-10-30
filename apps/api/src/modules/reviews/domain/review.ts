import type { WorkSummary } from '../../books/index.js';
import type { ProfileSummary } from '../../profiles/index.js';

export const MIN_RATING = 1;

export const MAX_RATING = 5;

export const REVIEW_TEXT_MAX_LENGTH = 1000;

export interface ReviewDraft {
  readonly rating: number;
  readonly text: string | null;
}

export interface NewReview extends ReviewDraft {
  readonly readingId: string;
  readonly userId: string;
  readonly workId: string;
  readonly finishedAt: Date;
}

export interface StoredReview extends NewReview {
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly cursorAt: string;
}

export interface Review extends Omit<StoredReview, 'cursorAt'> {
  readonly reader: ProfileSummary | null;
  readonly book: WorkSummary | null;
}

export interface SavedReview {
  readonly review: StoredReview;
  readonly created: boolean;
}
