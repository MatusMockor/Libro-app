import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class ReviewNotFoundException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.NOT_FOUND,
      code: 'review_not_found',
      detail: 'No such review.',
    });
  }
}
