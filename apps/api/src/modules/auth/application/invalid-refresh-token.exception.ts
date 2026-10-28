import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class InvalidRefreshTokenException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.UNAUTHORIZED,
      code: 'invalid_refresh_token',
      detail: 'The refresh token is invalid, expired or revoked. Sign in again.',
    });
  }
}
