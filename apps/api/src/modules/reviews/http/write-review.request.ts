import { z } from 'zod';
import { MAX_RATING, MIN_RATING, REVIEW_TEXT_MAX_LENGTH } from '../domain/review.js';
import { codePointLength, normaliseReviewText } from '../domain/review-text.js';
import { uuidSchema } from './review-fields.schema.js';

const reviewTextSchema = z
  .string()
  .overwrite(normaliseReviewText)
  .check((context) => {
    if (codePointLength(context.value) <= REVIEW_TEXT_MAX_LENGTH) {
      return;
    }

    context.issues.push({
      code: 'too_big',
      origin: 'string',
      maximum: REVIEW_TEXT_MAX_LENGTH,
      inclusive: true,
      input: context.value,
      message: `Too big: expected string to have <=${String(REVIEW_TEXT_MAX_LENGTH)} characters`,
    });
  })
  .meta({
    description: `At most ${String(REVIEW_TEXT_MAX_LENGTH)} characters (Unicode code points) after trimming; blank, null or left out means no text`,
    maxLength: REVIEW_TEXT_MAX_LENGTH,
  });

export const writeReviewSchema = z
  .object({
    rating: z
      .int()
      .min(MIN_RATING)
      .max(MAX_RATING)
      .meta({ description: `Whole stars, ${String(MIN_RATING)} to ${String(MAX_RATING)}` }),
    text: reviewTextSchema.nullable().optional(),
    photoId: uuidSchema.nullable().optional().meta({
      description:
        'One of your own uploaded photos (POST /v1/media) of the finished book; null or left out means no photo',
    }),
  })
  .meta({
    id: 'WriteReview',
    description: 'Replaces the whole review: a left out text or photo removes the current one',
  });

export type WriteReviewRequest = z.infer<typeof writeReviewSchema>;
