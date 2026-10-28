import { Inject, Injectable } from '@nestjs/common';
import { InvalidAccessTokenException } from '../../../http/authentication/invalid-access-token.exception.js';
import type { User } from '../domain/user.js';
import { USER_REPOSITORY, type UserRepository } from './user-repository.js';

@Injectable()
export class AccountService {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async getAccount(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new InvalidAccessTokenException();
    }

    return user;
  }
}
