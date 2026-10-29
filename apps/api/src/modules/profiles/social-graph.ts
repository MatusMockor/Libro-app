export const SOCIAL_GRAPH = Symbol('SOCIAL_GRAPH');

export interface SocialGraph {
  isFollowing(followerId: string, followeeId: string): Promise<boolean>;
  followeeIdsOf(userId: string): Promise<string[]>;
}
