import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class EmailAccountExistsException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.CONFLICT,
      code: 'email_account_exists',
      detail: 'An account with this email already exists. Sign in with the password.',
    });
  }
}
