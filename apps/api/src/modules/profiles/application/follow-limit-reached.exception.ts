import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class FollowLimitReachedException extends ProblemException {
  constructor(limit: number) {
    super({
      status: HttpStatus.CONFLICT,
      code: 'follow_limit_reached',
      detail: `A profile can follow at most ${String(limit)} profiles; unfollow some before following more.`,
    });
  }
}
