import { Inject, Injectable } from '@nestjs/common';
import { toMediaPhoto, type MediaWithUrls } from '../../media/index.js';
import { READING_REVIEWS, type ReadingReview, type ReadingReviews } from '../../reviews/index.js';
import type { ActivityReview, StoredActivity } from '../domain/activity.js';
import type { ActivityHydrator, HydrationPlan } from './activity-hydrator.js';
import { NO_REFERENCE_IDS } from './feed-references.service.js';
import { readingDetailsOf, readingIdsOf, workIdsOf } from './reading-activity-details.js';

@Injectable()
export class BookFinishedHydrator implements ActivityHydrator {
  constructor(@Inject(READING_REVIEWS) private readonly reviews: ReadingReviews) {}

  async plan(_viewerId: string, activities: readonly StoredActivity[]): Promise<HydrationPlan> {
    const reviews = await this.reviews.findForReadings(readingIdsOf(activities));
    const photoIds = [...reviews.values()]
      .map(({ photoMediaId }) => photoMediaId)
      .filter((mediaId): mediaId is string => mediaId !== null);

    return {
      references: { ...NO_REFERENCE_IDS, workIds: workIdsOf(activities), mediaIds: photoIds },
      detailsOf: (activity, { works, photos }) => {
        const review = activity.readingId === null ? undefined : reviews.get(activity.readingId);

        return readingDetailsOf(activity, works, review ? reviewOf(review, photos) : null);
      },
    };
  }
}

function reviewOf(
  { rating, text, photoMediaId }: ReadingReview,
  photos: ReadonlyMap<string, MediaWithUrls>,
): ActivityReview {
  const photo = photoMediaId === null ? undefined : photos.get(photoMediaId);

  return { rating, text, photo: photo ? toMediaPhoto(photo) : null };
}
