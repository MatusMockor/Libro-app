import { Injectable } from '@nestjs/common';
import type { IdentityProvider } from '../../identity-providers/index.js';
import type { AuthSession } from './auth-session.js';
import { IdentityAccountService } from './identity-account.service.js';
import { IdentityTokenService } from './identity-token.service.js';
import { SessionService } from './session.service.js';

@Injectable()
export class IdentitySignInService {
  constructor(
    private readonly identityTokens: IdentityTokenService,
    private readonly accounts: IdentityAccountService,
    private readonly sessions: SessionService,
  ) {}

  async signIn(provider: IdentityProvider, idToken: string): Promise<AuthSession> {
    const identity = await this.identityTokens.verifyOnce(provider, idToken);

    return this.sessions.start(await this.accounts.accountOf(identity));
  }
}
