import { Inject, Injectable } from '@nestjs/common';
import type { User } from '../domain/user.js';
import { ACCESS_TOKEN_ISSUER, type AccessTokenIssuer } from './access-token-issuer.js';
import type { AuthSession } from './auth-session.js';

@Injectable()
export class SessionService {
  constructor(@Inject(ACCESS_TOKEN_ISSUER) private readonly accessTokens: AccessTokenIssuer) {}

  async start(user: User): Promise<AuthSession> {
    return { user, accessToken: await this.accessTokens.issue(user.id) };
  }
}
