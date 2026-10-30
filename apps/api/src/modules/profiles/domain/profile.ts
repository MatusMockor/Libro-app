import type { WorkSummary } from '../../books/index.js';
import type { MediaWithUrls } from '../../media/index.js';
import type { Genre } from './genres.js';

export type Avatar = Pick<MediaWithUrls, 'variants' | 'urlsExpireAt'>;

export interface StoredProfileSummary {
  readonly userId: string;
  readonly handle: string;
  readonly displayName: string | null;
  readonly avatarMediaId: string | null;
  readonly official: boolean;
  readonly followedByMe: boolean;
}

export interface StoredProfile extends StoredProfileSummary {
  readonly bio: string | null;
  readonly favouriteGenres: readonly string[];
  readonly topBookIds: readonly string[];
  readonly followerCount: number;
  readonly followingCount: number;
}

export interface ProfileSummary {
  readonly userId: string;
  readonly handle: string;
  readonly displayName: string | null;
  readonly avatar: Avatar | null;
  readonly official: boolean;
  readonly followedByMe: boolean;
}

export interface Profile extends ProfileSummary {
  readonly bio: string | null;
  readonly favouriteGenres: readonly Genre[];
  readonly topBooks: readonly WorkSummary[];
  readonly followerCount: number;
  readonly followingCount: number;
}

export const MAX_TOP_BOOKS = 3;

export interface ProfileChanges {
  readonly handle?: string | undefined;
  readonly displayName?: string | null | undefined;
  readonly bio?: string | null | undefined;
  readonly favouriteGenres?: readonly Genre[] | undefined;
  readonly topBookIds?: readonly string[] | undefined;
  readonly avatarMediaId?: string | null | undefined;
}

export interface ProfileSearchQuery {
  readonly text: string;
  readonly limit: number;
  readonly offset: number;
}
