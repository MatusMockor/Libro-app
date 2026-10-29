import type { JWTVerifyGetKey } from 'jose';
import type { IdentityProvider } from '../domain/identity-provider.js';

export const OIDC_PROVIDER_CONFIGS = Symbol('OIDC_PROVIDER_CONFIGS');

export interface OidcProviderConfig {
  readonly provider: IdentityProvider;
  readonly issuers: readonly string[];
  readonly clientIds: readonly string[];
  readonly signingKeys: JWTVerifyGetKey;
}
