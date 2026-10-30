import { z } from 'zod';
import {
  REVIEW_PAGE_DEFAULT_LIMIT,
  REVIEW_PAGE_MAX_LIMIT,
  type ReviewPageQuery,
} from '../domain/review-page.js';
import { decodeCursor, isCursor } from './review-cursor.js';

export const reviewPageQuerySchema = z.object({
  cursor: z
    .string()
    .refine(isCursor, { error: 'Not a valid cursor; pass nextCursor of the previous page' })
    .optional()
    .meta({ description: 'nextCursor of the previous page; leave out for the first page' }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(REVIEW_PAGE_MAX_LIMIT)
    .default(REVIEW_PAGE_DEFAULT_LIMIT),
});

export type ReviewPageRequest = z.infer<typeof reviewPageQuerySchema>;

export function toReviewPageQuery({ cursor, limit }: ReviewPageRequest): ReviewPageQuery {
  return { limit, after: decodeCursor(cursor) };
}
