import { Inject, Injectable } from '@nestjs/common';
import { OnDomainEvent } from '../../../events/on-domain-event.decorator.js';
import { UserDeleted } from '../../auth/index.js';
import { PROFILE_REPOSITORY, type ProfileRepository } from './profile-repository.js';

@Injectable()
export class EraseProfileHandler {
  constructor(@Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository) {}

  @OnDomainEvent(UserDeleted)
  async onUserDeleted({ payload }: UserDeleted): Promise<void> {
    await this.profiles.delete(payload.userId);
  }
}
