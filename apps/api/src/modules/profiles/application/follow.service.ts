import { Inject, Injectable } from '@nestjs/common';
import { MAX_FOLLOWING } from '../domain/follow.js';
import { CannotFollowSelfException } from './cannot-follow-self.exception.js';
import { FollowLimitReachedException } from './follow-limit-reached.exception.js';
import { FOLLOW_REPOSITORY, type FollowRepository } from './follow-repository.js';
import { ProfileNotFoundException } from './profile-not-found.exception.js';
import { ProfileProvisioningService } from './profile-provisioning.service.js';

@Injectable()
export class FollowService {
  constructor(
    @Inject(FOLLOW_REPOSITORY) private readonly follows: FollowRepository,
    private readonly provisioning: ProfileProvisioningService,
  ) {}

  async follow(followerId: string, followeeId: string): Promise<void> {
    ensureNotSelf(followerId, followeeId);
    await this.provisioning.ensure(followerId);

    const result = await this.follows.follow({ followerId, followeeId, limit: MAX_FOLLOWING });
    if (result === 'followee_not_found') {
      throw new ProfileNotFoundException();
    }

    if (result === 'limit_reached') {
      throw new FollowLimitReachedException(MAX_FOLLOWING);
    }
  }

  async unfollow(followerId: string, followeeId: string): Promise<void> {
    ensureNotSelf(followerId, followeeId);

    if ((await this.follows.unfollow(followerId, followeeId)) === 'followee_not_found') {
      throw new ProfileNotFoundException();
    }
  }
}

function ensureNotSelf(followerId: string, followeeId: string): void {
  if (followerId === followeeId) {
    throw new CannotFollowSelfException();
  }
}
