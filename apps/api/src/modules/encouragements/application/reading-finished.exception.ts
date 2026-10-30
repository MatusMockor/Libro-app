import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class ReadingFinishedException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.CONFLICT,
      code: 'reading_finished',
      detail: 'Insights are for a reading in progress; congratulate a finished reading instead.',
    });
  }
}
