import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class ReadingSessionLimitReachedException extends ProblemException {
  constructor(records: string, limit: number) {
    super({
      status: HttpStatus.CONFLICT,
      code: 'reading_session_limit_reached',
      detail: `A reading session can hold at most ${String(limit)} ${records}.`,
    });
  }
}
