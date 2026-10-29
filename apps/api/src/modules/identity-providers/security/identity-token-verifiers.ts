import { Inject, Injectable } from '@nestjs/common';
import { IdentityProviderNotConfiguredException } from '../application/identity-provider-not-configured.exception.js';
import type { IdentityProvider } from '../domain/identity-provider.js';
import type { VerifiedIdentity } from '../domain/verified-identity.js';
import type { IdentityTokenVerifier } from '../identity-token-verifier.js';
import { OidcIdTokenVerifier } from './oidc-id-token.verifier.js';
import { OIDC_PROVIDER_CONFIGS, type OidcProviderConfig } from './oidc-provider-config.js';

@Injectable()
export class IdentityTokenVerifiers implements IdentityTokenVerifier {
  private readonly verifiers: ReadonlyMap<IdentityProvider, OidcIdTokenVerifier>;

  constructor(@Inject(OIDC_PROVIDER_CONFIGS) configs: readonly OidcProviderConfig[]) {
    this.verifiers = new Map(
      configs
        .filter(({ clientIds }) => clientIds.length > 0)
        .map((config) => [config.provider, new OidcIdTokenVerifier(config)]),
    );
  }

  isConfigured(provider: IdentityProvider): boolean {
    return this.verifiers.has(provider);
  }

  verify(provider: IdentityProvider, idToken: string): Promise<VerifiedIdentity> {
    const verifier = this.verifiers.get(provider);
    if (!verifier) {
      throw new IdentityProviderNotConfiguredException();
    }

    return verifier.verify(idToken);
  }
}
