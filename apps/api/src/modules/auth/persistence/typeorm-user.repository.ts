import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../../../database/unique-violation.js';
import { EmailAlreadyRegisteredException } from '../application/email-already-registered.exception.js';
import type { UserRepository } from '../application/user-repository.js';
import type { NewUser, User, UserCredentials } from '../domain/user.js';
import { USERS_EMAIL_KEY, UserEntity } from './user.entity.js';
import { toUser, toUserCredentials, toUserEntity } from './user.mapper.js';

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(@InjectRepository(UserEntity) private readonly users: Repository<UserEntity>) {}

  async add(user: NewUser): Promise<User> {
    try {
      return toUser(await this.users.save(toUserEntity(user)));
    } catch (error) {
      if (isUniqueViolation(error, USERS_EMAIL_KEY)) {
        throw new EmailAlreadyRegisteredException();
      }

      throw error;
    }
  }

  async findById(userId: string): Promise<User | undefined> {
    const user = await this.users.findOneBy({ id: userId });

    return user ? toUser(user) : undefined;
  }

  async findCredentialsByEmail(email: string): Promise<UserCredentials | undefined> {
    const user = await this.users.findOneBy({ email });

    return user ? toUserCredentials(user) : undefined;
  }
}
