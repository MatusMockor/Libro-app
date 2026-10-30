import { z } from 'zod';
import {
  ENCOURAGEMENT_PAGE_DEFAULT_LIMIT,
  ENCOURAGEMENT_PAGE_MAX_LIMIT,
  type EncouragementPageQuery,
} from '../domain/encouragement-page.js';
import { decodeCursor, isCursor } from './encouragement-cursor.js';

export const encouragementPageQuerySchema = z.object({
  cursor: z
    .string()
    .refine(isCursor, { error: 'Not a valid cursor; pass nextCursor of the previous page' })
    .optional()
    .meta({ description: 'nextCursor of the previous page; leave out for the first page' }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(ENCOURAGEMENT_PAGE_MAX_LIMIT)
    .default(ENCOURAGEMENT_PAGE_DEFAULT_LIMIT),
});

export type EncouragementPageRequest = z.infer<typeof encouragementPageQuerySchema>;

export function toEncouragementPageQuery({
  cursor,
  limit,
}: EncouragementPageRequest): EncouragementPageQuery {
  return { limit, after: decodeCursor(cursor) };
}
