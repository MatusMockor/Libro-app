import { z } from 'zod';
import type { MediaVariantUrl } from '../../media/index.js';
import type { ReviewPage } from '../domain/review-page.js';
import type { Review, ReviewPhoto } from '../domain/review.js';
import { encodeCursor } from './review-cursor.js';
import { reviewReaderSchema, toReviewReaderResponse } from './review-reader.response.js';

const bookSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    authors: z.array(z.object({ id: z.uuid(), name: z.string() })),
  })
  .meta({ id: 'ReviewBook' });

const photoVariantSchema = z.object({
  url: z.url().meta({ description: 'Signed URL of the WebP file, valid until urlsExpireAt' }),
  width: z.int(),
  height: z.int(),
});

const photoSchema = z
  .object({
    mediaId: z.uuid(),
    width: z.int().meta({ description: 'Width of the large variant' }),
    height: z.int().meta({ description: 'Height of the large variant' }),
    variants: z.object({
      small: photoVariantSchema.meta({ description: 'Longer side at most 256 px' }),
      medium: photoVariantSchema.meta({ description: 'Longer side at most 1080 px' }),
      large: photoVariantSchema.meta({ description: 'Longer side at most 2048 px' }),
    }),
    urlsExpireAt: z.iso.datetime().meta({
      description: 'When the variant URLs stop working; fetch the review again for fresh URLs',
    }),
  })
  .meta({ id: 'ReviewPhoto' });

export const reviewSchema = z
  .object({
    readingId: z.uuid().meta({ description: 'The finished reading (read-through) reviewed' }),
    readerId: z.uuid(),
    reader: reviewReaderSchema.nullable().meta({
      description: 'The profile of the reader; null when the reader has no profile',
    }),
    book: bookSchema
      .nullable()
      .meta({ description: 'The book read; null when it is no longer in the catalogue' }),
    rating: z.int().meta({ description: 'Whole stars, 1 to 5' }),
    text: z.string().nullable(),
    finishedAt: z.iso.datetime(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    photo: photoSchema.nullable().meta({
      description: 'Photo of the finished book; null without one or once the photo was deleted',
    }),
  })
  .meta({ id: 'Review' });

export const reviewPageSchema = z
  .object({
    items: z.array(reviewSchema),
    nextCursor: z
      .string()
      .nullable()
      .meta({ description: 'Opaque cursor of the next page, null on the last' }),
  })
  .meta({ id: 'ReviewPage' });

export type ReviewResponse = z.infer<typeof reviewSchema>;

export type ReviewPageResponse = z.infer<typeof reviewPageSchema>;

export function toReviewResponse(review: Review): ReviewResponse {
  return {
    readingId: review.readingId,
    readerId: review.userId,
    reader: toReviewReaderResponse(review.reader),
    book: review.book && {
      id: review.book.id,
      title: review.book.title,
      authors: review.book.authors.map(({ id, name }) => ({ id, name })),
    },
    rating: review.rating,
    text: review.text,
    finishedAt: review.finishedAt.toISOString(),
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    photo: review.photo && toPhotoResponse(review.photo),
  };
}

export function toReviewPageResponse({
  items,
  nextCursor,
}: ReviewPage<Review>): ReviewPageResponse {
  return { items: items.map(toReviewResponse), nextCursor: encodeCursor(nextCursor) };
}

type PhotoResponse = z.infer<typeof photoSchema>;

function toPhotoResponse({
  id,
  width,
  height,
  variants,
  urlsExpireAt,
}: ReviewPhoto): PhotoResponse {
  return {
    mediaId: id,
    width,
    height,
    variants: {
      small: toVariantResponse(variants.small),
      medium: toVariantResponse(variants.medium),
      large: toVariantResponse(variants.large),
    },
    urlsExpireAt: urlsExpireAt.toISOString(),
  };
}

function toVariantResponse({ url, width, height }: MediaVariantUrl): MediaVariantUrl {
  return { url, width, height };
}
