import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../problem-details/problem.exception.js';

export class InvalidAccessTokenException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.UNAUTHORIZED,
      code: 'invalid_access_token',
      detail: 'The access token is invalid or expired.',
      headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' },
    });
  }
}
