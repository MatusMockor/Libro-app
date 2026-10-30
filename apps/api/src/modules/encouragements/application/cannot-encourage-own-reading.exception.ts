import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class CannotEncourageOwnReadingException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.CONFLICT,
      code: 'cannot_encourage_own_reading',
      detail: 'Insights and congratulations are for the readings of others.',
    });
  }
}
