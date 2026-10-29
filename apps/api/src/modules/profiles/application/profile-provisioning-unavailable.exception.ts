import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

const RETRY_AFTER_SECONDS = 1;

export class ProfileProvisioningUnavailableException extends ProblemException {
  constructor(userId: string) {
    super({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      code: 'profile_provisioning_unavailable',
      detail: `No free default handle was found for the profile of user ${userId}.`,
      headers: { 'Retry-After': String(RETRY_AFTER_SECONDS) },
    });
  }
}
