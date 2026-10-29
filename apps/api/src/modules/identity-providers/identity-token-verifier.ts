import type { IdentityProvider } from './domain/identity-provider.js';
import type { VerifiedIdentity } from './domain/verified-identity.js';

export const IDENTITY_TOKEN_VERIFIER = Symbol('IDENTITY_TOKEN_VERIFIER');

export interface IdentityTokenVerifier {
  isConfigured(provider: IdentityProvider): boolean;
  verify(provider: IdentityProvider, idToken: string): Promise<VerifiedIdentity>;
}
