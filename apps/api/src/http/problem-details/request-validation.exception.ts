import { HttpStatus } from '@nestjs/common';
import type { FieldError } from './problem-details.schema.js';
import { ProblemException } from './problem.exception.js';

export class RequestValidationException extends ProblemException {
  constructor(errors: FieldError[]) {
    super({
      status: HttpStatus.BAD_REQUEST,
      code: 'validation_failed',
      detail: 'The request contains invalid fields.',
      errors,
    });
  }
}
