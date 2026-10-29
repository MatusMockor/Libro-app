import { z } from 'zod';
import { REACTION_KEYS, REACTIONS, type ReactionKey } from '../domain/reactions.js';

export const reactionKeySchema = z
  .enum(REACTION_KEYS)
  .meta({ description: 'Stable key of the reaction, used in URLs' });

export const reactionEmojiSchema = z
  .enum(Object.values(REACTIONS))
  .meta({ description: 'The emoji the app shows for the key' });

export function reactionOf(key: ReactionKey): {
  key: ReactionKey;
  emoji: (typeof REACTIONS)[ReactionKey];
} {
  return { key, emoji: REACTIONS[key] };
}
