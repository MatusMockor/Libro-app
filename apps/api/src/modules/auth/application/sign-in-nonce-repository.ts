import type { IdentityProvider } from '../../identity-providers/index.js';

export const SIGN_IN_NONCE_REPOSITORY = Symbol('SIGN_IN_NONCE_REPOSITORY');

export interface StoredSignInNonce {
  readonly provider: IdentityProvider;
  readonly hash: string;
}

export interface NewSignInNonce extends StoredSignInNonce {
  readonly lifetimeSeconds: number;
}

export interface SignInNonceRepository {
  issue(nonce: NewSignInNonce): Promise<void>;
  consume(nonce: StoredSignInNonce): Promise<boolean>;
}
