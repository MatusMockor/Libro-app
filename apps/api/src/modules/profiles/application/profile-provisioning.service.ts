import { Inject, Injectable, Logger } from '@nestjs/common';
import { defaultHandle, DEFAULT_HANDLE_SUFFIX_LENGTHS } from '../domain/handle.js';
import { HANDLE_SUFFIX_SOURCE, type HandleSuffixSource } from './handle-suffix-source.js';
import { ProfileProvisioningUnavailableException } from './profile-provisioning-unavailable.exception.js';
import { PROFILE_REPOSITORY, type ProfileRepository } from './profile-repository.js';

@Injectable()
export class ProfileProvisioningService {
  private readonly logger = new Logger(ProfileProvisioningService.name);

  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
    @Inject(HANDLE_SUFFIX_SOURCE) private readonly suffixes: HandleSuffixSource,
  ) {}

  async ensure(userId: string): Promise<void> {
    if (await this.profiles.exists(userId)) {
      return;
    }

    for (const length of DEFAULT_HANDLE_SUFFIX_LENGTHS) {
      const handle = defaultHandle(this.suffixes.digits(length));
      if ((await this.profiles.create(userId, handle)) !== 'handle_taken') {
        return;
      }
    }

    this.logger.warn(
      `No free default handle after ${String(DEFAULT_HANDLE_SUFFIX_LENGTHS.length)} attempts for user ${userId}`,
    );
    throw new ProfileProvisioningUnavailableException(userId);
  }
}
