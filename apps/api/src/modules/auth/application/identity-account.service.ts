import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../events/event-bus.js';
import type { VerifiedIdentity } from '../../identity-providers/index.js';
import { normaliseEmail } from '../domain/email.js';
import type { User } from '../domain/user.js';
import { UserRegistered } from '../events/user-registered.event.js';
import { EmailAccountExistsException } from './email-account-exists.exception.js';
import { IdentityConflictException } from './identity-conflict.exception.js';
import { IdentityEmailNotVerifiedException } from './identity-email-not-verified.exception.js';
import { IDENTITY_REPOSITORY, type IdentityRepository } from './identity-repository.js';

@Injectable()
export class IdentityAccountService {
  constructor(
    @Inject(IDENTITY_REPOSITORY) private readonly identities: IdentityRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async accountOf(identity: VerifiedIdentity): Promise<User> {
    const { provider, subject } = identity;
    const existing = await this.identities.findUser({ provider, subject });
    if (existing) {
      return existing;
    }

    const result = await this.identities.link({
      provider,
      subject,
      email: verifiedEmail(identity),
      mayLinkExistingAccount: identity.emailAuthoritative,
    });
    if (result.kind === 'conflict') {
      throw new IdentityConflictException();
    }

    if (result.kind === 'existing_account') {
      throw new EmailAccountExistsException();
    }

    if (result.kind === 'created') {
      await this.events.publish(UserRegistered.create({ userId: result.user.id }));
    }

    return result.user;
  }
}

function verifiedEmail({ email, emailVerified }: VerifiedIdentity): string {
  if (!emailVerified || email === undefined) {
    throw new IdentityEmailNotVerifiedException();
  }

  return normaliseEmail(email);
}
