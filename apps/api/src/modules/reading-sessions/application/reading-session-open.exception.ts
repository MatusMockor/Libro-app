import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class ReadingSessionOpenException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.CONFLICT,
      code: 'reading_session_open',
      detail: 'A reading session of this reading is still open. End it before finishing the book.',
    });
  }
}
