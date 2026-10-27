import { describe, expect } from 'vitest';
import { integrationTest } from './support/integration-test.js';
import { ProbeModule } from './support/probe/probe.module.js';

const test = integrationTest({ imports: [ProbeModule] });

interface ValidationProblem {
  status: number;
  code: string;
  errors: { path: string; message: string; code: string }[];
}

describe('request validation', () => {
  test('passes a valid body to the handler', async ({ http }) => {
    const response = await http.post('/v1/probe/books').send({ title: 'Dune', pages: 412 });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ title: 'Dune', pages: 412 });
  });

  test('strips fields the schema does not declare', async ({ http }) => {
    const response = await http
      .post('/v1/probe/books')
      .send({ title: 'Dune', pages: 412, isAdmin: true });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ title: 'Dune', pages: 412 });
  });

  test('rejects an invalid body with every broken field path', async ({ http }) => {
    const response = await http
      .post('/v1/probe/books')
      .send({ title: '', pages: 'many', tags: ['ok', 7] });
    const body = response.body as ValidationProblem;

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(body.code).toBe('validation_failed');
    expect(body.errors.map(({ path, code }) => ({ path, code }))).toEqual([
      { path: 'title', code: 'too_small' },
      { path: 'pages', code: 'invalid_type' },
      { path: 'tags.1', code: 'invalid_type' },
    ]);
    expect(body.errors.every(({ message }) => message.length > 0)).toBe(true);
  });

  test('reports a missing body field as invalid_type', async ({ http }) => {
    const response = await http.post('/v1/probe/books').send({ title: 'Dune' });
    const body = response.body as ValidationProblem;

    expect(response.status).toBe(400);
    expect(body.errors).toEqual([
      { path: 'pages', code: 'invalid_type', message: expect.any(String) as string },
    ]);
  });

  test('coerces and passes a valid query', async ({ http }) => {
    const response = await http.get('/v1/probe/books').query({ limit: '20', extra: 'x' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ limit: 20 });
  });

  test('rejects an invalid query with the field path', async ({ http }) => {
    const response = await http.get('/v1/probe/books').query({ limit: '500' });
    const body = response.body as ValidationProblem;

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(body.errors.map(({ path, code }) => ({ path, code }))).toEqual([
      { path: 'limit', code: 'too_big' },
    ]);
  });

  test('rejects invalid route params', async ({ http }) => {
    const response = await http.get('/v1/probe/books/not-a-uuid');
    const body = response.body as ValidationProblem;

    expect(response.status).toBe(400);
    expect(body.errors.map(({ path, code }) => ({ path, code }))).toEqual([
      { path: 'id', code: 'invalid_format' },
    ]);
  });

  test('rejects malformed JSON as a bad request', async ({ http }) => {
    const response = await http
      .post('/v1/probe/books')
      .set('Content-Type', 'application/json')
      .send('{"title": ');

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({ status: 400, code: 'bad_request' });
  });
});
