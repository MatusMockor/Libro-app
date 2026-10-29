import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class CannotJoinOwnSessionException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.CONFLICT,
      code: 'cannot_join_own_session',
      detail: 'You cannot join your own reading session.',
    });
  }
}
