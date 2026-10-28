import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type {
  RefreshTokenGenerator,
  RefreshTokenSecret,
} from '../application/refresh-token-generator.js';
import { REFRESH_TOKEN_BYTES } from '../domain/refresh-token.js';

@Injectable()
export class RandomRefreshTokenGenerator implements RefreshTokenGenerator {
  generate(): RefreshTokenSecret {
    const value = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');

    return { value, hash: this.hashOf(value) };
  }

  hashOf(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
