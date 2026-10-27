import type { LoggerService } from '@nestjs/common';
import { describe, expect } from 'vitest';
import { integrationTest } from './support/integration-test.js';
import { ProbeModule } from './support/probe/probe.module.js';

const test = integrationTest({ imports: [ProbeModule] });

class CapturingLogger implements LoggerService {
  readonly errors: string[] = [];

  log(): void {}

  warn(): void {}

  error(...parts: unknown[]): void {
    this.errors.push(parts.map(String).join('\n'));
  }
}

describe('problem details for errors', () => {
  test('answers an unknown route with 404 problem+json', async ({ http }) => {
    const response = await http.get('/v1/no-such-route?token=secret');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({
      status: 404,
      code: 'not_found',
      instance: '/v1/no-such-route',
    });
  });

  test('maps a thrown HttpException to its status and message', async ({ http }) => {
    const response = await http.get('/v1/probe/conflict');

    expect(response.status).toBe(409);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({
      title: 'Conflict',
      status: 409,
      code: 'conflict',
      detail: 'The book is already on the shelf.',
    });
  });

  test('keeps the code of a ProblemException', async ({ http }) => {
    const response = await http.get('/v1/probe/problem');

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'book_already_finished',
      detail: 'The book is already finished.',
    });
  });

  test('hides the detail of a 5xx ProblemException, keeps its code and logs it', async ({
    app,
    http,
  }) => {
    const logger = new CapturingLogger();
    app.useLogger(logger);

    const response = await http.get('/v1/probe/problem-unavailable');

    expect(response.status).toBe(503);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({
      title: 'Service Unavailable',
      status: 503,
      code: 'catalogue_unavailable',
      detail: 'Service Unavailable',
    });
    expect(response.text).not.toContain('10.0.0.7');
    expect(response.body).not.toHaveProperty('errors');
    expect(logger.errors).toHaveLength(1);
    expect(logger.errors[0]).toContain('open library at 10.0.0.7:8080 timed out');
  });

  test('hides the message of a 5xx HttpException and logs it', async ({ app, http }) => {
    const logger = new CapturingLogger();
    app.useLogger(logger);

    const response = await http.get('/v1/probe/unavailable');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      title: 'Service Unavailable',
      status: 503,
      code: 'service_unavailable',
      detail: 'Service Unavailable',
    });
    expect(response.text).not.toContain('10.0.0.3');
    expect(logger.errors[0]).toContain('redis at 10.0.0.3:6379 is down');
  });

  test('hides an unexpected error from the client and logs it', async ({ app, http }) => {
    const logger = new CapturingLogger();
    app.useLogger(logger);

    const response = await http.get('/v1/probe/crash');

    expect(response.status).toBe(500);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({
      status: 500,
      code: 'internal_server_error',
      detail: 'An unexpected error occurred.',
    });
    expect(response.text).not.toContain('secret');
    expect(response.text).not.toContain('probe.controller');
    expect(logger.errors).toHaveLength(1);
    expect(logger.errors[0]).toContain('connection to postgres://libro:secret@db failed');
    expect(logger.errors[0]).toContain('probe.controller');
  });
});
