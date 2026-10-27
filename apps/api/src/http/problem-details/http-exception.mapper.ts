import { STATUS_CODES } from 'node:http';
import { HttpException } from '@nestjs/common';
import { isServerError, problem, type Problem } from './problem.js';
import type { ProblemMapper } from './problem-mapper.js';

export class HttpExceptionMapper implements ProblemMapper {
  toProblem(exception: unknown): Problem | undefined {
    if (!(exception instanceof HttpException)) {
      return undefined;
    }

    const status = exception.getStatus();
    const phrase = STATUS_CODES[status] ?? `HTTP ${String(status)}`;

    return problem({ status, code: toCode(phrase), detail: publicDetail(exception, phrase) });
  }
}

function publicDetail(exception: HttpException, phrase: string): string {
  if (isServerError(exception.getStatus())) {
    return phrase;
  }

  return exception.message;
}

function toCode(phrase: string): string {
  return phrase
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}
