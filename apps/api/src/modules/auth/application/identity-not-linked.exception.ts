import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class IdentityNotLinkedException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.UNAUTHORIZED,
      code: 'identity_not_linked',
      detail: 'The identity token does not belong to a provider account linked to this account.',
    });
  }
}
