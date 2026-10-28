import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class ReadingSessionAlreadyOpenException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.CONFLICT,
      code: 'reading_session_already_open',
      detail: 'Another reading session is still open. End it before starting a new one.',
    });
  }
}
