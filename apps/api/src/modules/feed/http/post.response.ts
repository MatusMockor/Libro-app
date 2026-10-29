import { z } from 'zod';
import type { FeedPage } from '../domain/feed-page.js';
import type { Post } from '../domain/post.js';
import { encodeCursor } from './feed-cursor.js';
import { feedProfileSchema, toFeedProfileResponse } from './profile-summary.response.js';
import { reactionEmojiSchema, reactionKeySchema, reactionOf } from './reaction-fields.schema.js';

const bookSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    authors: z.array(z.object({ id: z.uuid(), name: z.string() })),
  })
  .meta({ id: 'PostBook' });

const reactionCountSchema = z
  .object({
    key: reactionKeySchema,
    emoji: reactionEmojiSchema,
    count: z.int().meta({ description: 'How many readers reacted with it, at least 1' }),
    reactedByMe: z.boolean().meta({ description: 'Whether the signed-in user reacted with it' }),
  })
  .meta({ id: 'PostReactionCount' });

export const postSchema = z
  .object({
    id: z.uuid(),
    authorId: z.uuid(),
    author: feedProfileSchema.nullable().meta({
      description: 'The profile of the author; null when the author has no profile',
    }),
    text: z.string(),
    book: bookSchema.nullable().meta({ description: 'The book the post is about' }),
    place: z.string().nullable(),
    createdAt: z.iso.datetime(),
    likeCount: z.int(),
    likedByMe: z.boolean().meta({ description: 'Whether the signed-in user likes the post' }),
    reactions: z.array(reactionCountSchema).meta({
      description:
        'The reactions the post got, in the order of GET /v1/feed/reactions; unused ones are left out',
    }),
    photos: z
      .array(z.never())
      .meta({ description: 'Photos of the post; always empty until photo posts arrive' }),
  })
  .meta({ id: 'Post' });

export const postPageSchema = z
  .object({
    items: z.array(postSchema),
    nextCursor: z
      .string()
      .nullable()
      .meta({ description: 'Opaque cursor of the next page, null on the last' }),
  })
  .meta({ id: 'PostPage' });

export type PostResponse = z.infer<typeof postSchema>;

export type PostPageResponse = z.infer<typeof postPageSchema>;

export function toPostResponse(post: Post): PostResponse {
  return {
    id: post.id,
    authorId: post.authorId,
    author: toFeedProfileResponse(post.author),
    text: post.text,
    book: post.book && {
      id: post.book.id,
      title: post.book.title,
      authors: post.book.authors.map(({ id, name }) => ({ id, name })),
    },
    place: post.place,
    createdAt: post.createdAt.toISOString(),
    likeCount: post.likeCount,
    likedByMe: post.likedByMe,
    reactions: post.reactions.map(({ key, count, reactedByMe }) => ({
      ...reactionOf(key),
      count,
      reactedByMe,
    })),
    photos: [],
  };
}

export function toPostPageResponse({ items, nextCursor }: FeedPage<Post>): PostPageResponse {
  return { items: items.map(toPostResponse), nextCursor: encodeCursor(nextCursor) };
}
