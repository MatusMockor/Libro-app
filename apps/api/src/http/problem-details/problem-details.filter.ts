import {
  Catch,
  HttpStatus,
  Inject,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { PROBLEM_CONTENT_TYPE, type ProblemDetails } from './problem-details.schema.js';
import { isServerError, problem, type Problem } from './problem.js';
import { PROBLEM_MAPPERS, type ProblemMapper } from './problem-mapper.js';

const INTERNAL_ERROR = problem({
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  code: 'internal_server_error',
  detail: 'An unexpected error occurred.',
});

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    @Inject(PROBLEM_MAPPERS) private readonly mappers: readonly ProblemMapper[],
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.adapterHost;
    const context = host.switchToHttp();
    const response = context.getResponse<unknown>();
    const details = this.problemFor(exception);

    this.logServerError(details, exception);

    if (httpAdapter.isHeadersSent(response)) {
      httpAdapter.end(response);
      return;
    }

    const instance = this.instanceOf(httpAdapter.getRequestUrl(context.getRequest()) as string);

    for (const [name, value] of Object.entries(details.headers ?? {})) {
      httpAdapter.setHeader(response, name, value);
    }
    httpAdapter.setHeader(response, 'Content-Type', PROBLEM_CONTENT_TYPE);
    httpAdapter.reply(response, toProblemDetails(details, instance), details.status);
  }

  private problemFor(exception: unknown): Problem {
    for (const mapper of this.mappers) {
      const mapped = mapper.toProblem(exception);
      if (mapped) {
        return mapped;
      }
    }

    return INTERNAL_ERROR;
  }

  private logServerError(details: Problem, exception: unknown): void {
    if (!isServerError(details.status)) {
      return;
    }

    if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      return;
    }

    this.logger.error(String(exception));
  }

  private instanceOf(url: string): string {
    return url.split('?')[0] ?? url;
  }
}

function toProblemDetails(details: Problem, instance: string): ProblemDetails {
  const { type, title, status, detail, code, errors } = details;
  const body = { type, title, status, detail, instance, code };

  return errors ? { ...body, errors } : body;
}
