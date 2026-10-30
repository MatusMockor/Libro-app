import type { FeedPageQuery } from '../domain/feed-page.js';
import type { ReactionTarget, StoredReaction } from '../domain/reaction.js';

export const REACTION_REPOSITORY = Symbol('REACTION_REPOSITORY');

export interface ReactionRepository {
  add(target: ReactionTarget): Promise<boolean>;
  remove(target: ReactionTarget): Promise<boolean>;
  listOf(postId: string, page: FeedPageQuery): Promise<StoredReaction[] | undefined>;
}
