import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class InvalidSessionTransitionException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.CONFLICT,
      code: 'invalid_session_transition',
      detail: 'The reading session cannot make this change in its current state.',
    });
  }
}
