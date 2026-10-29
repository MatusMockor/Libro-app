import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class IdentityEmailNotVerifiedException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.FORBIDDEN,
      code: 'identity_email_not_verified',
      detail: 'The provider has not verified the email of this account.',
    });
  }
}
