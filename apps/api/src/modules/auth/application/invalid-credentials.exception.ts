import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class InvalidCredentialsException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.UNAUTHORIZED,
      code: 'invalid_credentials',
      detail: 'The email or password is incorrect.',
    });
  }
}
