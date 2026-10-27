import { describe, expect } from 'vitest';
import { integrationTest } from './support/integration-test.js';
import { ProbeModule } from './support/probe/probe.module.js';

const test = integrationTest({ imports: [ProbeModule] });

const PROBLEM_JSON = /^application\/problem\+json(;|$)/;

describe('v1 response contract', () => {
  test('validation error', async ({ http }) => {
    const response = await http.post('/v1/probe/books').send({ title: 'Dune', pages: 0 });

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(PROBLEM_JSON);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'The request contains invalid fields.',
      instance: '/v1/probe/books',
      code: 'validation_failed',
      errors: [
        { path: 'pages', message: 'Too small: expected number to be >0', code: 'too_small' },
      ],
    });
  });

  test('unknown route', async ({ http }) => {
    const response = await http.get('/v1/unknown');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(PROBLEM_JSON);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Cannot GET /v1/unknown',
      instance: '/v1/unknown',
      code: 'not_found',
    });
  });

  test('HttpException', async ({ http }) => {
    const response = await http.get('/v1/probe/conflict');

    expect(response.status).toBe(409);
    expect(response.headers['content-type']).toMatch(PROBLEM_JSON);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'The book is already on the shelf.',
      instance: '/v1/probe/conflict',
      code: 'conflict',
    });
  });

  test('unexpected error', async ({ app, http }) => {
    app.useLogger(false);

    const response = await http.get('/v1/probe/crash');

    expect(response.status).toBe(500);
    expect(response.headers['content-type']).toMatch(PROBLEM_JSON);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred.',
      instance: '/v1/probe/crash',
      code: 'internal_server_error',
    });
  });

  test('health', async ({ http }) => {
    const response = await http.get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ status: 'ok', checks: { database: 'up' } });
  });
});
