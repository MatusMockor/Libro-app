import type { IdentityProvider } from './identity-provider.js';

export interface VerifiedIdentity {
  readonly provider: IdentityProvider;
  readonly subject: string;
  readonly email: string | undefined;
  readonly emailVerified: boolean;
  readonly emailAuthoritative: boolean;
  readonly nonce: string;
}
