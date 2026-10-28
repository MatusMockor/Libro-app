import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class ReadingSessionNotActiveException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.CONFLICT,
      code: 'reading_session_not_active',
      detail: 'Checkpoints can be recorded only while the reading session is active.',
    });
  }
}
