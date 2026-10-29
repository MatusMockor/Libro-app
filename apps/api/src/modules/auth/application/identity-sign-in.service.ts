import { Inject, Injectable } from '@nestjs/common';
import {
  IDENTITY_TOKEN_VERIFIER,
  type IdentityProvider,
  type IdentityTokenVerifier,
} from '../../identity-providers/index.js';
import type { AuthSession } from './auth-session.js';
import { IdentityAccountService } from './identity-account.service.js';
import { SessionService } from './session.service.js';
import { SignInNonceService } from './sign-in-nonce.service.js';

@Injectable()
export class IdentitySignInService {
  constructor(
    @Inject(IDENTITY_TOKEN_VERIFIER) private readonly verifier: IdentityTokenVerifier,
    private readonly nonces: SignInNonceService,
    private readonly accounts: IdentityAccountService,
    private readonly sessions: SessionService,
  ) {}

  async signIn(provider: IdentityProvider, idToken: string): Promise<AuthSession> {
    const identity = await this.verifier.verify(provider, idToken);
    await this.nonces.consume(provider, identity.nonce);

    return this.sessions.start(await this.accounts.accountOf(identity));
  }
}
