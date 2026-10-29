import { Inject, Injectable } from '@nestjs/common';
import { MAX_FOLLOWING } from '../domain/follow.js';
import type { SocialGraph } from '../social-graph.js';
import { FOLLOW_REPOSITORY, type FollowRepository } from './follow-repository.js';

@Injectable()
export class SocialGraphService implements SocialGraph {
  constructor(@Inject(FOLLOW_REPOSITORY) private readonly follows: FollowRepository) {}

  isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    return this.follows.isFollowing(followerId, followeeId);
  }

  followeeIdsOf(userId: string): Promise<string[]> {
    return this.follows.followeeIdsOf(userId, MAX_FOLLOWING);
  }
}
