import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class EmailAlreadyRegisteredException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.CONFLICT,
      code: 'email_already_registered',
      detail: 'An account with this email already exists.',
    });
  }
}
