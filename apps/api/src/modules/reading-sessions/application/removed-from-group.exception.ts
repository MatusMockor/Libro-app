import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class RemovedFromGroupException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.FORBIDDEN,
      code: 'removed_from_group',
      detail: 'The host removed you from this reading group.',
    });
  }
}
