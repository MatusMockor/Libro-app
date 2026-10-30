import type { WorkSummary } from '../../books/index.js';
import type { ProfileSummary } from '../../profiles/index.js';
import type { PostPhoto } from './post-photo.js';
import type { ReactionKey } from './reactions.js';

export interface NewPost {
  readonly authorId: string;
  readonly text: string | null;
  readonly workId: string | null;
  readonly place: string | null;
  readonly photoIds: readonly string[];
}

export interface ReactionCount {
  readonly key: ReactionKey;
  readonly count: number;
  readonly reactedByMe: boolean;
}

export interface StoredPost {
  readonly id: string;
  readonly authorId: string;
  readonly text: string | null;
  readonly workId: string | null;
  readonly place: string | null;
  readonly photoIds: readonly string[];
  readonly createdAt: Date;
  readonly cursorAt: string;
  readonly likeCount: number;
  readonly likedByMe: boolean;
  readonly reactions: readonly ReactionCount[];
}

export interface Post extends Omit<StoredPost, 'workId' | 'photoIds'> {
  readonly author: ProfileSummary | null;
  readonly book: WorkSummary | null;
  readonly photos: readonly PostPhoto[];
}
