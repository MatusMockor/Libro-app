import { Inject, Injectable } from '@nestjs/common';
import { normalisePassword } from '../domain/password.js';
import { InvalidCredentialsException } from './invalid-credentials.exception.js';
import { PasswordCheckService } from './password-check.service.js';
import { USER_REPOSITORY, type UserRepository } from './user-repository.js';

@Injectable()
export class PasswordConfirmationService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly passwords: PasswordCheckService,
  ) {}

  async confirm(userId: string, password: string): Promise<void> {
    const stored = await this.users.findCredentialsById(userId);
    const matches = await this.passwords.matches(stored?.passwordHash, normalisePassword(password));

    if (!matches) {
      throw new InvalidCredentialsException();
    }
  }
}
