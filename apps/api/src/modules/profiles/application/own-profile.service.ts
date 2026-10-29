import { Inject, Injectable } from '@nestjs/common';
import type { Profile, ProfileChanges, StoredProfile } from '../domain/profile.js';
import { blankToNull } from '../domain/profile-text.js';
import { ProfileAssemblerService } from './profile-assembler.service.js';
import { ProfileNotFoundException } from './profile-not-found.exception.js';
import { ProfileProvisioningService } from './profile-provisioning.service.js';
import { ProfileReferencesService } from './profile-references.service.js';
import { PROFILE_REPOSITORY, type ProfileRepository } from './profile-repository.js';

@Injectable()
export class OwnProfileService {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
    private readonly provisioning: ProfileProvisioningService,
    private readonly references: ProfileReferencesService,
    private readonly assembler: ProfileAssemblerService,
  ) {}

  async get(userId: string): Promise<Profile> {
    const stored = (await this.profiles.findById(userId, userId)) ?? (await this.provision(userId));

    return this.assembler.profile(stored);
  }

  async update(userId: string, changes: ProfileChanges): Promise<Profile> {
    await this.references.verify(userId, changes);
    await this.provisioning.ensure(userId);
    await this.profiles.update(userId, {
      ...changes,
      displayName: blankToNull(changes.displayName),
      bio: blankToNull(changes.bio),
    });

    return this.get(userId);
  }

  private async provision(userId: string): Promise<StoredProfile> {
    await this.provisioning.ensure(userId);
    const stored = await this.profiles.findById(userId, userId);
    if (!stored) {
      throw new ProfileNotFoundException();
    }

    return stored;
  }
}
