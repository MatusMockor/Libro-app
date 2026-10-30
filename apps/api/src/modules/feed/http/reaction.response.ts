import { z } from 'zod';
import type { FeedPage } from '../domain/feed-page.js';
import type { Reaction } from '../domain/reaction.js';
import { REACTION_KEYS } from '../domain/reactions.js';
import { encodeCursor } from './feed-cursor.js';
import { feedProfileSchema, toFeedProfileResponse } from './profile-summary.response.js';
import { reactionEmojiSchema, reactionKeySchema, reactionOf } from './reaction-fields.schema.js';

const reactionSchema = z
  .object({
    userId: z.uuid(),
    user: feedProfileSchema.nullable().meta({
      description: 'The profile of the reader who reacted; null when the reader has no profile',
    }),
    key: reactionKeySchema,
    emoji: reactionEmojiSchema,
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'PostReaction' });

export const reactionPageSchema = z
  .object({
    items: z.array(reactionSchema),
    nextCursor: z
      .string()
      .nullable()
      .meta({ description: 'Opaque cursor of the next page, null on the last' }),
  })
  .meta({ id: 'PostReactionPage' });

export const reactionSetSchema = z
  .object({
    reactions: z
      .array(z.object({ key: reactionKeySchema, emoji: reactionEmojiSchema }))
      .meta({ description: 'Every reaction a post can get, in display order' }),
  })
  .meta({ id: 'FeedReactions' });

export type ReactionPageResponse = z.infer<typeof reactionPageSchema>;

export type ReactionSetResponse = z.infer<typeof reactionSetSchema>;

export function toReactionPageResponse({
  items,
  nextCursor,
}: FeedPage<Reaction>): ReactionPageResponse {
  return {
    items: items.map(({ userId, user, key, createdAt }) => ({
      userId,
      user: toFeedProfileResponse(user),
      ...reactionOf(key),
      createdAt: createdAt.toISOString(),
    })),
    nextCursor: encodeCursor(nextCursor),
  };
}

export function reactionSet(): ReactionSetResponse {
  return { reactions: REACTION_KEYS.map(reactionOf) };
}
