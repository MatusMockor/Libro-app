import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IDENTITY_TOKEN_VERIFIER,
  IdentityProviderNotConfiguredException,
  InvalidIdentityTokenException,
  type IdentityProvider,
  type IdentityTokenVerifier,
} from '../../identity-providers/index.js';
import { SIGN_IN_NONCE_LIFETIME_SECONDS } from '../domain/sign-in-nonce.js';
import { SIGN_IN_NONCE_GENERATOR, type SignInNonceGenerator } from './sign-in-nonce-generator.js';
import {
  SIGN_IN_NONCE_REPOSITORY,
  type SignInNonceRepository,
} from './sign-in-nonce-repository.js';
import type { SignInNonce } from './sign-in-nonce.js';

@Injectable()
export class SignInNonceService {
  private readonly logger = new Logger(SignInNonceService.name);

  constructor(
    @Inject(SIGN_IN_NONCE_REPOSITORY) private readonly nonces: SignInNonceRepository,
    @Inject(SIGN_IN_NONCE_GENERATOR) private readonly generator: SignInNonceGenerator,
    @Inject(IDENTITY_TOKEN_VERIFIER) private readonly verifier: IdentityTokenVerifier,
  ) {}

  async issue(provider: IdentityProvider): Promise<SignInNonce> {
    if (!this.verifier.isConfigured(provider)) {
      throw new IdentityProviderNotConfiguredException();
    }

    const nonce = this.generator.generate();
    await this.nonces.issue({
      provider,
      hash: nonce.hash,
      lifetimeSeconds: SIGN_IN_NONCE_LIFETIME_SECONDS,
    });

    return { value: nonce.value, expiresIn: SIGN_IN_NONCE_LIFETIME_SECONDS };
  }

  async consume(provider: IdentityProvider, nonce: string): Promise<void> {
    const consumed = await this.nonces.consume({ provider, hash: this.generator.hashOf(nonce) });
    if (!consumed) {
      this.logger.debug(`Rejected ${provider} ID token: nonce unknown, expired or already used`);
      throw new InvalidIdentityTokenException();
    }
  }
}
