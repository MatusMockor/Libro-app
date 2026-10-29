import type { FollowDecision } from '../domain/follow.js';

export const FOLLOW_REPOSITORY = Symbol('FOLLOW_REPOSITORY');

export interface NewFollow {
  readonly followerId: string;
  readonly followeeId: string;
  readonly limit: number;
}

export type UnfollowResult = 'unfollowed' | 'followee_not_found';

export interface FollowRepository {
  follow(follow: NewFollow): Promise<FollowDecision>;
  unfollow(followerId: string, followeeId: string): Promise<UnfollowResult>;
  isFollowing(followerId: string, followeeId: string): Promise<boolean>;
  followeeIdsOf(userId: string, limit: number): Promise<string[]>;
}
