import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { AuthSession } from './auth-session.js';
import { normaliseCredentials, type Credentials } from './credentials.js';
import { InvalidCredentialsException } from './invalid-credentials.exception.js';
import { PASSWORD_HASHER, type PasswordHasher } from './password-hasher.js';
import { SessionService } from './session.service.js';
import { USER_REPOSITORY, type UserRepository } from './user-repository.js';

@Injectable()
export class LoginService implements OnModuleInit {
  private unknownUserHash = '';

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher,
    private readonly sessions: SessionService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.unknownUserHash = await this.passwords.hash(randomBytes(32).toString('base64url'));
  }

  async login(credentials: Credentials): Promise<AuthSession> {
    const { email, password } = normaliseCredentials(credentials);
    const stored = await this.users.findCredentialsByEmail(email);
    const matches = await this.passwords.verify(
      stored?.passwordHash ?? this.unknownUserHash,
      password,
    );

    if (!stored || !matches) {
      throw new InvalidCredentialsException();
    }

    return this.sessions.start(stored.user);
  }
}
