import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class NotInGroupException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.CONFLICT,
      code: 'not_in_group',
      detail: 'The reading session is not a participant of a reading group.',
    });
  }
}
