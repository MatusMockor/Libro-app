import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';
import { MAX_GROUP_PARTICIPANTS } from '../domain/reading-group.js';

export class GroupFullException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.CONFLICT,
      code: 'group_full',
      detail: `A reading group holds at most ${String(MAX_GROUP_PARTICIPANTS)} participants.`,
    });
  }
}
