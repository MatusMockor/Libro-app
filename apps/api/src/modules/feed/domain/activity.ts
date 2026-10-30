import type { WorkSummary } from '../../books/index.js';
import type { MediaPhoto } from '../../media/index.js';
import type { ProfileSummary } from '../../profiles/index.js';
import type { Post } from './post.js';

export const ACTIVITY_KINDS = ['post', 'reading_started', 'book_finished'] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const POST_ACTIVITY = 'post' satisfies ActivityKind;

export type ReadingActivityKind = Exclude<ActivityKind, typeof POST_ACTIVITY>;

export const READING_ACTIVITY_KINDS: readonly ReadingActivityKind[] = [
  'reading_started',
  'book_finished',
];

export interface StoredActivity {
  readonly id: string;
  readonly kind: ActivityKind;
  readonly actorId: string;
  readonly postId: string | null;
  readonly readingId: string | null;
  readonly workId: string | null;
  readonly createdAt: Date;
  readonly cursorAt: string;
}

export interface NewReadingActivity {
  readonly kind: ReadingActivityKind;
  readonly actorId: string;
  readonly readingId: string;
  readonly workId: string;
}

export interface ActivityReview {
  readonly rating: number;
  readonly text: string | null;
  readonly photo: MediaPhoto | null;
}

export interface ReadingDetails {
  readonly readingId: string;
  readonly book: WorkSummary | null;
  readonly review: ActivityReview | null;
}

export interface ActivityDetails {
  readonly post: Post | null;
  readonly reading: ReadingDetails | null;
}

export interface Activity extends ActivityDetails {
  readonly id: string;
  readonly kind: ActivityKind;
  readonly actorId: string;
  readonly actor: ProfileSummary | null;
  readonly createdAt: Date;
}
