import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class CannotFollowSelfException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.CONFLICT,
      code: 'cannot_follow_self',
      detail: 'A profile cannot follow itself.',
    });
  }
}
