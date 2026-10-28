import { Injectable } from '@nestjs/common';
import { hash, verify, type Options } from '@node-rs/argon2';
import type { PasswordHasher } from '../application/password-hasher.js';

export const ARGON2_OPTIONS: Readonly<Options> = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }
}
