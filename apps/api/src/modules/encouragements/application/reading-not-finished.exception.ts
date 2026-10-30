import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class ReadingNotFinishedException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.CONFLICT,
      code: 'reading_not_finished',
      detail: 'Only a finished reading can be congratulated.',
    });
  }
}
