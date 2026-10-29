export const MAX_FOLLOWING = 2000;

export interface FollowState {
  readonly following: boolean;
  readonly followeeExists: boolean;
  readonly followingCount: number;
}

export type FollowDecision =
  'followed' | 'already_following' | 'followee_not_found' | 'limit_reached';

export function decideFollow(
  { following, followeeExists, followingCount }: FollowState,
  limit: number,
): FollowDecision {
  if (following) {
    return 'already_following';
  }

  if (!followeeExists) {
    return 'followee_not_found';
  }

  return followingCount >= limit ? 'limit_reached' : 'followed';
}
