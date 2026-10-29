import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type {
  SignInNonceGenerator,
  SignInNonceSecret,
} from '../application/sign-in-nonce-generator.js';
import { SIGN_IN_NONCE_BYTES } from '../domain/sign-in-nonce.js';

@Injectable()
export class RandomSignInNonceGenerator implements SignInNonceGenerator {
  generate(): SignInNonceSecret {
    const value = randomBytes(SIGN_IN_NONCE_BYTES).toString('base64url');

    return { value, hash: this.hashOf(value) };
  }

  hashOf(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
