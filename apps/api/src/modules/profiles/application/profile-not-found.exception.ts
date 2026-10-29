import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class ProfileNotFoundException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.NOT_FOUND,
      code: 'profile_not_found',
      detail: 'No such profile was found.',
    });
  }
}
