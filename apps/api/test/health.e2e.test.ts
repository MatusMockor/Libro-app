import { describe, expect } from 'vitest';
import { test } from './support/integration-test.js';

describe('GET /health', () => {
  test('reports the api and the database as healthy', async ({ http }) => {
    const response = await http.get('/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toEqual({ status: 'ok', checks: { database: 'up' } });
  });

  test('is version neutral and not exposed under a version prefix', async ({ http }) => {
    const response = await http.get('/v1/health');

    expect(response.status).toBe(404);
  });
});
