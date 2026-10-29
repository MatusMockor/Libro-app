import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../events/event-bus.js';
import type { DeletionConfirmation } from '../domain/account-deletion.js';
import { UserDeleted } from '../events/user-deleted.event.js';
import { DeletionReplayService } from './deletion-replay.service.js';
import { IdentityConfirmationService } from './identity-confirmation.service.js';
import { PasswordConfirmationService } from './password-confirmation.service.js';
import { USER_REPOSITORY, type UserRepository } from './user-repository.js';

@Injectable()
export class AccountDeletionService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly passwords: PasswordConfirmationService,
    private readonly identities: IdentityConfirmationService,
    private readonly replays: DeletionReplayService,
  ) {}

  async delete(userId: string, confirmation: DeletionConfirmation): Promise<void> {
    await this.confirm(userId, confirmation);

    if (!(await this.users.delete(userId))) {
      return;
    }

    await this.events.publish(UserDeleted.create({ userId }));
    this.replays.scheduleFor(userId);
  }

  private confirm(userId: string, confirmation: DeletionConfirmation): Promise<void> {
    if (confirmation.kind === 'password') {
      return this.passwords.confirm(userId, confirmation.password);
    }

    return this.identities.confirm(userId, confirmation.provider, confirmation.idToken);
  }
}
