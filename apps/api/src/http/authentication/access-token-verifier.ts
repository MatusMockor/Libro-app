import type { AuthenticatedUser } from './authenticated-user.js';

export const ACCESS_TOKEN_VERIFIER = Symbol('ACCESS_TOKEN_VERIFIER');

export interface AccessTokenVerifier {
  verify(token: string): Promise<AuthenticatedUser | undefined>;
}
