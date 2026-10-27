import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../problem-details/problem.exception.js';

export class InvalidAppClientException extends ProblemException {
  constructor(reason: string) {
    super({ status: HttpStatus.BAD_REQUEST, code: 'invalid_app_client', detail: reason });
  }
}
