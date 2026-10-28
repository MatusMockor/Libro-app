import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class ReadingAlreadyFinishedException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.CONFLICT,
      code: 'reading_already_finished',
      detail: 'This reading is already finished.',
    });
  }
}
