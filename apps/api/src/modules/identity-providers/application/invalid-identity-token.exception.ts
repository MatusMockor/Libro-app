import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class InvalidIdentityTokenException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.UNAUTHORIZED,
      code: 'invalid_identity_token',
      detail: 'The identity token is invalid, expired or already used. Sign in again.',
    });
  }
}
