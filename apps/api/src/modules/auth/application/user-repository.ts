import type { NewUser, User, UserCredentials } from '../domain/user.js';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepository {
  add(user: NewUser): Promise<User>;
  exists(userId: string): Promise<boolean>;
  findById(userId: string): Promise<User | undefined>;
  findCredentialsById(userId: string): Promise<UserCredentials | undefined>;
  findCredentialsByEmail(email: string): Promise<UserCredentials | undefined>;
  delete(userId: string): Promise<boolean>;
}
