import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class HandleTakenException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.CONFLICT,
      code: 'handle_taken',
      detail: 'Another profile already uses this handle.',
    });
  }
}
