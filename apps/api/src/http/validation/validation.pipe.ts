import { StandardSchemaValidationPipe } from '@nestjs/common';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { RequestValidationException } from '../problem-details/request-validation.exception.js';
import { toFieldError } from './field-error.js';
import { nulCharacterIssues } from './nul-characters.js';

export class TextSafeValidationPipe extends StandardSchemaValidationPipe {
  protected override async validate<T = unknown>(
    value: unknown,
    schema: StandardSchemaV1,
    options?: Record<string, unknown>,
  ): Promise<StandardSchemaV1.Result<T>> {
    const result = await super.validate<T>(value, schema, options);
    if (result.issues) {
      return result;
    }

    const issues = nulCharacterIssues(result.value);

    return issues.length > 0 ? { issues } : result;
  }
}

export function createValidationPipe(): StandardSchemaValidationPipe {
  return new TextSafeValidationPipe({
    exceptionFactory: (issues) => new RequestValidationException(issues.map(toFieldError)),
  });
}
