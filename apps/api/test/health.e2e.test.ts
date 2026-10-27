import { describe, expect } from 'vitest';
import { test } from './support/integration-test.js';

describe('GET /health', () => {
  test('reports the api as healthy', async ({ http }) => {
    const response = await http.get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  test('is version neutral and not exposed under a version prefix', async ({ http }) => {
    const response = await http.get('/v1/health');

    expect(response.status).toBe(404);
  });
});
