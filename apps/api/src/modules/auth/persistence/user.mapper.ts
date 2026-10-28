import type { NewUser, User, UserCredentials } from '../domain/user.js';
import { UserEntity } from './user.entity.js';

export function toUserEntity({ email, passwordHash }: NewUser): UserEntity {
  return Object.assign(new UserEntity(), { email, passwordHash });
}

export function toUser({ id, email }: UserEntity): User {
  return { id, email };
}

export function toUserCredentials(entity: UserEntity): UserCredentials {
  return { user: toUser(entity), passwordHash: entity.passwordHash };
}
