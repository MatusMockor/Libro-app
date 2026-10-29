import { Injectable } from '@nestjs/common';
import { OnDomainEvent } from '../../../events/on-domain-event.decorator.js';
import { UserRegistered } from '../../auth/index.js';
import { ProfileProvisioningService } from './profile-provisioning.service.js';

@Injectable()
export class CreateProfileOnRegistrationHandler {
  constructor(private readonly provisioning: ProfileProvisioningService) {}

  @OnDomainEvent(UserRegistered)
  async onUserRegistered({ payload }: UserRegistered): Promise<void> {
    await this.provisioning.ensure(payload.userId);
  }
}
