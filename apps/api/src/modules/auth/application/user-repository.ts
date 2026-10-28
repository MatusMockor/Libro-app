import type { NewUser, User, UserCredentials } from '../domain/user.js';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepository {
  add(user: NewUser): Promise<User>;
  findById(userId: string): Promise<User | undefined>;
  findCredentialsByEmail(email: string): Promise<UserCredentials | undefined>;
}
