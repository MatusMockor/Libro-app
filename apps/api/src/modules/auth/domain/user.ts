export interface User {
  readonly id: string;
  readonly email: string;
}

export interface NewUser {
  readonly email: string;
  readonly passwordHash: string;
}

export interface UserCredentials {
  readonly user: User;
  readonly passwordHash: string;
}
