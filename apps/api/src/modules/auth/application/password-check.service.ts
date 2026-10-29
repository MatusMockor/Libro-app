import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PASSWORD_HASHER, type PasswordHasher } from './password-hasher.js';

const UNKNOWN_USER_SECRET_BYTES = 32;

@Injectable()
export class PasswordCheckService implements OnModuleInit {
  private unknownUserHash = '';

  constructor(@Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher) {}

  async onModuleInit(): Promise<void> {
    this.unknownUserHash = await this.passwords.hash(
      randomBytes(UNKNOWN_USER_SECRET_BYTES).toString('base64url'),
    );
  }

  async matches(passwordHash: string | null | undefined, password: string): Promise<boolean> {
    const matches = await this.passwords.verify(passwordHash ?? this.unknownUserHash, password);

    return typeof passwordHash === 'string' && matches;
  }
}
