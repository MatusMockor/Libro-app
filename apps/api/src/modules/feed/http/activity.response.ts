import { z } from 'zod';
import { mediaPhotoFields, toMediaPhotoResponse } from '../../media/index.js';
import { ACTIVITY_KINDS, type Activity, type ReadingDetails } from '../domain/activity.js';
import type { FeedPage } from '../domain/feed-page.js';
import { encodeCursor } from './feed-cursor.js';
import { postSchema, toPostResponse } from './post.response.js';
import { feedProfileSchema, toFeedProfileResponse } from './profile-summary.response.js';

const bookSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    authors: z.array(z.object({ id: z.uuid(), name: z.string() })),
  })
  .meta({ id: 'ActivityBook' });

const reviewPhotoSchema = z.object(mediaPhotoFields('feed')).meta({ id: 'ActivityReviewPhoto' });

const reviewSchema = z
  .object({
    rating: z.int().meta({ description: 'Stars, 1 to 5' }),
    text: z.string().nullable(),
    photo: reviewPhotoSchema
      .nullable()
      .meta({ description: 'The photo of the finished book; null without one' }),
  })
  .meta({ id: 'ActivityReview' });

const readingSchema = z
  .object({
    readingId: z.uuid().meta({
      description: 'The reading, to add an insight or a congratulation to it',
    }),
    book: bookSchema.nullable().meta({ description: 'null for a book no longer in the catalogue' }),
    review: reviewSchema.nullable().meta({
      description: 'The rating and review of a finished book; null when there is none yet',
    }),
  })
  .meta({ id: 'ActivityReading' });

export const activitySchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(ACTIVITY_KINDS).meta({
      description: 'What happened; new kinds can be added, ignore the ones you do not know',
    }),
    actorId: z.uuid(),
    actor: feedProfileSchema.nullable().meta({
      description: 'The profile of the reader who did it; null when the reader has no profile',
    }),
    createdAt: z.iso.datetime(),
    post: postSchema.nullable().meta({ description: 'The post of a post activity, else null' }),
    reading: readingSchema.nullable().meta({
      description: 'The reading of a reading_started or book_finished activity, else null',
    }),
  })
  .meta({ id: 'Activity' });

export const activityPageSchema = z
  .object({
    items: z.array(activitySchema),
    nextCursor: z
      .string()
      .nullable()
      .meta({ description: 'Opaque cursor of the next page, null on the last' }),
  })
  .meta({ id: 'ActivityPage' });

export type ActivityResponse = z.infer<typeof activitySchema>;

export type ActivityPageResponse = z.infer<typeof activityPageSchema>;

type ReadingResponse = z.infer<typeof readingSchema>;

export function toActivityPageResponse({
  items,
  nextCursor,
}: FeedPage<Activity>): ActivityPageResponse {
  return { items: items.map(toActivityResponse), nextCursor: encodeCursor(nextCursor) };
}

function toActivityResponse(activity: Activity): ActivityResponse {
  return {
    id: activity.id,
    kind: activity.kind,
    actorId: activity.actorId,
    actor: toFeedProfileResponse(activity.actor),
    createdAt: activity.createdAt.toISOString(),
    post: activity.post && toPostResponse(activity.post),
    reading: activity.reading && toReadingResponse(activity.reading),
  };
}

function toReadingResponse({ readingId, book, review }: ReadingDetails): ReadingResponse {
  return {
    readingId,
    book: book && {
      id: book.id,
      title: book.title,
      authors: book.authors.map(({ id, name }) => ({ id, name })),
    },
    review: review && {
      rating: review.rating,
      text: review.text,
      photo: review.photo && toMediaPhotoResponse(review.photo),
    },
  };
}
