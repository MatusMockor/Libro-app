export const REACTIONS = {
  heart: '❤️',
  books: '📚',
  clap: '👏',
  wow: '😮',
  laugh: '😂',
  hug: '🤗',
  thinking: '🤔',
} as const;

export type ReactionKey = keyof typeof REACTIONS;

export type ReactionEmoji = (typeof REACTIONS)[ReactionKey];

export const REACTION_KEYS = Object.keys(REACTIONS) as [ReactionKey, ...ReactionKey[]];

export function isReactionKey(value: string): value is ReactionKey {
  return Object.hasOwn(REACTIONS, value);
}

export function reactionOrder(key: ReactionKey): number {
  return REACTION_KEYS.indexOf(key);
}

export function inReactionOrder<TReaction extends { readonly key: ReactionKey }>(
  reactions: readonly TReaction[],
): TReaction[] {
  return reactions.toSorted((left, right) => reactionOrder(left.key) - reactionOrder(right.key));
}
