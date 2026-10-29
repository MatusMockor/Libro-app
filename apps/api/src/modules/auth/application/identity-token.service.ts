import { Inject, Injectable } from '@nestjs/common';
import {
  IDENTITY_TOKEN_VERIFIER,
  type IdentityProvider,
  type IdentityTokenVerifier,
  type VerifiedIdentity,
} from '../../identity-providers/index.js';
import { SignInNonceService } from './sign-in-nonce.service.js';

@Injectable()
export class IdentityTokenService {
  constructor(
    @Inject(IDENTITY_TOKEN_VERIFIER) private readonly verifier: IdentityTokenVerifier,
    private readonly nonces: SignInNonceService,
  ) {}

  async verifyOnce(provider: IdentityProvider, idToken: string): Promise<VerifiedIdentity> {
    const identity = await this.verifier.verify(provider, idToken);
    await this.nonces.consume(provider, identity.nonce);

    return identity;
  }
}
