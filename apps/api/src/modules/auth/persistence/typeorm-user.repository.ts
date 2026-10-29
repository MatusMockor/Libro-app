import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../../../database/unique-violation.js';
import { EmailAlreadyRegisteredException } from '../application/email-already-registered.exception.js';
import type { UserRepository } from '../application/user-repository.js';
import type { NewUser, User, UserCredentials } from '../domain/user.js';
import { USERS_EMAIL_KEY, UserEntity } from './user.entity.js';
import { toUser, toUserCredentials, toUserEntity } from './user.mapper.js';

const SELECT_EXISTS = `
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = $1) AS "exists"
`;

const DELETE_USER_LEAVING_TOMBSTONE = `
  WITH deleted AS (
    DELETE FROM auth.users WHERE id = $1 RETURNING id
  )
  INSERT INTO auth.deleted_accounts (user_id)
  SELECT id FROM deleted
  RETURNING user_id AS "userId"
`;

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

  async exists(userId: string): Promise<boolean> {
    const [row] = await this.users.query<[{ exists: boolean }]>(SELECT_EXISTS, [userId]);

    return row.exists;
  }

  async findById(userId: string): Promise<User | undefined> {
    const user = await this.users.findOneBy({ id: userId });

    return user ? toUser(user) : undefined;
  }

  async findCredentialsById(userId: string): Promise<UserCredentials | undefined> {
    const user = await this.users.findOneBy({ id: userId });

    return user ? toUserCredentials(user) : undefined;
  }

  async findCredentialsByEmail(email: string): Promise<UserCredentials | undefined> {
    const user = await this.users.findOneBy({ email });

    return user ? toUserCredentials(user) : undefined;
  }

  async delete(userId: string): Promise<boolean> {
    const deleted = await this.users.query<{ userId: string }[]>(DELETE_USER_LEAVING_TOMBSTONE, [
      userId,
    ]);

    return deleted.length === 1;
  }
}
