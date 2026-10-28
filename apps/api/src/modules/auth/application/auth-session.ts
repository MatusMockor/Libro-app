import type { User } from '../domain/user.js';
import type { AccessToken } from './access-token-issuer.js';

export interface RefreshToken {
  readonly value: string;
  readonly expiresIn: number;
}

export interface AuthSession {
  readonly user: User;
  readonly accessToken: AccessToken;
  readonly refreshToken: RefreshToken;
}
