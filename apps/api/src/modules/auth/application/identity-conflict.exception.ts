import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class IdentityConflictException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.CONFLICT,
      code: 'identity_conflict',
      detail: 'The account with this email is already linked to another account of this provider.',
    });
  }
}
