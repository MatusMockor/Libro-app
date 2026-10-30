import { z } from 'zod';
import { uuidSchema } from './review-fields.schema.js';

export const reviewParamsSchema = z.object({
  readingId: uuidSchema,
});

export const readerReviewsParamsSchema = z.object({
  userId: uuidSchema,
});

export const workReviewsParamsSchema = z.object({
  workId: uuidSchema,
});

export type ReviewParams = z.infer<typeof reviewParamsSchema>;

export type ReaderReviewsParams = z.infer<typeof readerReviewsParamsSchema>;

export type WorkReviewsParams = z.infer<typeof workReviewsParamsSchema>;
