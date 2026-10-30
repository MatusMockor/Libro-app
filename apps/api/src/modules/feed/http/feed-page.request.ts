import { z } from 'zod';
import {
  FEED_PAGE_DEFAULT_LIMIT,
  FEED_PAGE_MAX_LIMIT,
  type FeedPageQuery,
} from '../domain/feed-page.js';
import { decodeCursor, isCursor } from './feed-cursor.js';
import { uuidSchema } from './feed-fields.schema.js';

const pageFields = {
  cursor: z
    .string()
    .refine(isCursor, { error: 'Not a valid cursor; pass nextCursor of the previous page' })
    .optional()
    .meta({ description: 'nextCursor of the previous page; leave out for the first page' }),
  limit: z.coerce.number().int().min(1).max(FEED_PAGE_MAX_LIMIT).default(FEED_PAGE_DEFAULT_LIMIT),
};

export const feedPageQuerySchema = z.object(pageFields);

export const authorPostsQuerySchema = z.object({
  authorId: uuidSchema.meta({ description: 'The user whose posts are listed' }),
  ...pageFields,
});

export type FeedPageRequest = z.infer<typeof feedPageQuerySchema>;

export type AuthorPostsRequest = z.infer<typeof authorPostsQuerySchema>;

export function toFeedPageQuery({ cursor, limit }: FeedPageRequest): FeedPageQuery {
  return { limit, after: decodeCursor(cursor) };
}
