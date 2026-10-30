import type { WorkSummary } from '../../books/index.js';
import type { ActivityDetails, ActivityReview, StoredActivity } from '../domain/activity.js';

export function readingDetailsOf(
  { readingId, workId }: StoredActivity,
  works: ReadonlyMap<string, WorkSummary>,
  review: ActivityReview | null,
): ActivityDetails | undefined {
  if (readingId === null || workId === null) {
    return undefined;
  }

  return { post: null, reading: { readingId, book: works.get(workId) ?? null, review } };
}

export function workIdsOf(activities: readonly StoredActivity[]): string[] {
  return activities
    .map(({ workId }) => workId)
    .filter((workId): workId is string => workId !== null);
}

export function readingIdsOf(activities: readonly StoredActivity[]): string[] {
  return activities
    .map(({ readingId }) => readingId)
    .filter((readingId): readingId is string => readingId !== null);
}
