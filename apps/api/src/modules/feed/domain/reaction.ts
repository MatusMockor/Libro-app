import type { ProfileSummary } from '../../profiles/index.js';
import type { ReactionKey } from './reactions.js';

export interface StoredReaction {
  readonly id: string;
  readonly userId: string;
  readonly key: ReactionKey;
  readonly createdAt: Date;
  readonly cursorAt: string;
}

export interface Reaction extends StoredReaction {
  readonly user: ProfileSummary | null;
}

export interface ReactionTarget {
  readonly postId: string;
  readonly userId: string;
  readonly key: ReactionKey;
}
