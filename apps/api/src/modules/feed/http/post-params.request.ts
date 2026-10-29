import { z } from 'zod';
import { REACTION_KEYS } from '../domain/reactions.js';
import { uuidSchema } from './feed-fields.schema.js';

export const postParamsSchema = z.object({
  postId: uuidSchema,
});

export const reactionParamsSchema = z.object({
  postId: uuidSchema,
  reaction: z.enum(REACTION_KEYS).meta({
    description: 'Key of the reaction (GET /v1/feed/reactions lists them with their emoji)',
  }),
});

export type PostParams = z.infer<typeof postParamsSchema>;

export type ReactionParams = z.infer<typeof reactionParamsSchema>;
