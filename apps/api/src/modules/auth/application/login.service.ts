import { Inject, Injectable } from '@nestjs/common';
import type { AuthSession } from './auth-session.js';
import { normaliseCredentials, type Credentials } from './credentials.js';
import { InvalidCredentialsException } from './invalid-credentials.exception.js';
import { PasswordCheckService } from './password-check.service.js';
import { SessionService } from './session.service.js';
import { USER_REPOSITORY, type UserRepository } from './user-repository.js';

@Injectable()
export class LoginService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly passwords: PasswordCheckService,
    private readonly sessions: SessionService,
  ) {}

  async login(credentials: Credentials): Promise<AuthSession> {
    const { email, password } = normaliseCredentials(credentials);
    const stored = await this.users.findCredentialsByEmail(email);
    const matches = await this.passwords.matches(stored?.passwordHash, password);

    if (!stored || !matches) {
      throw new InvalidCredentialsException();
    }

    return this.sessions.start(stored.user);
  }
}
