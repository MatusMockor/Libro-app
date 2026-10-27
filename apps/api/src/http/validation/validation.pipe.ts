import { StandardSchemaValidationPipe } from '@nestjs/common';
import { RequestValidationException } from '../problem-details/request-validation.exception.js';
import { toFieldError } from './field-error.js';

export function createValidationPipe(): StandardSchemaValidationPipe {
  return new StandardSchemaValidationPipe({
    exceptionFactory: (issues) => new RequestValidationException(issues.map(toFieldError)),
  });
}
