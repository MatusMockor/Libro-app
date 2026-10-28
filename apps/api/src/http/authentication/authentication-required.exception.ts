import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../problem-details/problem.exception.js';

export class AuthenticationRequiredException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.UNAUTHORIZED,
      code: 'authentication_required',
      detail: 'This endpoint needs an access token in the Authorization header (Bearer).',
      headers: { 'WWW-Authenticate': 'Bearer' },
    });
  }
}
