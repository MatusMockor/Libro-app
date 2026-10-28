import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class ReadingNotFoundException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.NOT_FOUND,
      code: 'reading_not_found',
      detail: 'No such reading.',
    });
  }
}
