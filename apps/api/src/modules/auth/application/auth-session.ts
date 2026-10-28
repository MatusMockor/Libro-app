import type { User } from '../domain/user.js';
import type { AccessToken } from './access-token-issuer.js';

export interface AuthSession {
  readonly user: User;
  readonly accessToken: AccessToken;
}
