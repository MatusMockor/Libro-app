import { Inject, Injectable, Logger } from '@nestjs/common';
import { secondsUntil, sessionExpiry } from '../domain/session.js';
import type { User } from '../domain/user.js';
import { ACCESS_TOKEN_ISSUER, type AccessTokenIssuer } from './access-token-issuer.js';
import type { AuthSession } from './auth-session.js';
import { InvalidRefreshTokenException } from './invalid-refresh-token.exception.js';
import {
  REFRESH_TOKEN_GENERATOR,
  type RefreshTokenGenerator,
  type RefreshTokenSecret,
} from './refresh-token-generator.js';
import { SESSION_REPOSITORY, type SessionRepository } from './session-repository.js';
import { USER_REPOSITORY, type UserRepository } from './user-repository.js';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ACCESS_TOKEN_ISSUER) private readonly accessTokens: AccessTokenIssuer,
    @Inject(REFRESH_TOKEN_GENERATOR) private readonly refreshTokens: RefreshTokenGenerator,
  ) {}

  async start(user: User): Promise<AuthSession> {
    const expiresAt = sessionExpiry(new Date());
    const refreshToken = this.refreshTokens.generate();

    await this.sessions.start({ userId: user.id, expiresAt, refreshTokenHash: refreshToken.hash });

    return this.issue(user, refreshToken, expiresAt);
  }

  async refresh(presentedToken: string): Promise<AuthSession> {
    const replacement = this.refreshTokens.generate();
    const rotation = await this.sessions.rotate({
      presentedHash: this.refreshTokens.hashOf(presentedToken),
      replacementHash: replacement.hash,
    });

    if (rotation.kind === 'reused') {
      this.logger.warn(`Refresh token reuse detected, revoked session ${rotation.sessionId}`);
    }

    if (rotation.kind !== 'rotated') {
      throw new InvalidRefreshTokenException();
    }

    const user = await this.users.findById(rotation.userId);
    if (!user) {
      throw new InvalidRefreshTokenException();
    }

    return this.issue(user, replacement, rotation.expiresAt);
  }

  async end(presentedToken: string): Promise<void> {
    await this.sessions.revokeByToken(this.refreshTokens.hashOf(presentedToken));
  }

  private async issue(
    user: User,
    refreshToken: RefreshTokenSecret,
    sessionExpiresAt: Date,
  ): Promise<AuthSession> {
    const accessToken = await this.accessTokens.issue(user.id);

    return {
      user,
      accessToken,
      refreshToken: {
        value: refreshToken.value,
        expiresIn: secondsUntil(sessionExpiresAt, new Date()),
      },
    };
  }
}
