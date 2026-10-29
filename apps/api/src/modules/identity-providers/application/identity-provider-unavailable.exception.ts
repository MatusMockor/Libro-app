import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class IdentityProviderUnavailableException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      code: 'identity_provider_unavailable',
      detail: 'The identity provider could not be reached. Try again later.',
    });
  }
}
