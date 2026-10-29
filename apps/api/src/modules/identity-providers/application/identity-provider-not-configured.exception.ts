import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class IdentityProviderNotConfiguredException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      code: 'identity_provider_not_configured',
      detail: 'Signing in with this provider is not available.',
    });
  }
}
