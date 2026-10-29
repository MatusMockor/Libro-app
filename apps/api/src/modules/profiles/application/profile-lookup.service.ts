import { Inject, Injectable } from '@nestjs/common';
import type { Profile, StoredProfile } from '../domain/profile.js';
import { ProfileAssemblerService } from './profile-assembler.service.js';
import { ProfileNotFoundException } from './profile-not-found.exception.js';
import { PROFILE_REPOSITORY, type ProfileRepository } from './profile-repository.js';

@Injectable()
export class ProfileLookupService {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
    private readonly assembler: ProfileAssemblerService,
  ) {}

  async byId(viewerId: string, userId: string): Promise<Profile> {
    return this.assembled(await this.profiles.findById(viewerId, userId));
  }

  async byHandle(viewerId: string, handle: string): Promise<Profile> {
    return this.assembled(await this.profiles.findByHandle(viewerId, handle));
  }

  private assembled(stored: StoredProfile | undefined): Promise<Profile> {
    if (!stored) {
      throw new ProfileNotFoundException();
    }

    return this.assembler.profile(stored);
  }
}
