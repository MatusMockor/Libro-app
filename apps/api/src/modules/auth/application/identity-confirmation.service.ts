import { Inject, Injectable } from '@nestjs/common';
import type { IdentityProvider } from '../../identity-providers/index.js';
import { IDENTITY_REPOSITORY, type IdentityRepository } from './identity-repository.js';
import { IdentityNotLinkedException } from './identity-not-linked.exception.js';
import { IdentityTokenService } from './identity-token.service.js';

@Injectable()
export class IdentityConfirmationService {
  constructor(
    private readonly identityTokens: IdentityTokenService,
    @Inject(IDENTITY_REPOSITORY) private readonly identities: IdentityRepository,
  ) {}

  async confirm(userId: string, provider: IdentityProvider, idToken: string): Promise<void> {
    const { subject } = await this.identityTokens.verifyOnce(provider, idToken);
    const owner = await this.identities.findUser({ provider, subject });

    if (owner?.id !== userId) {
      throw new IdentityNotLinkedException();
    }
  }
}
