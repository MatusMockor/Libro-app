import { describe, expect } from 'vitest';
import { integrationTest } from './support/integration-test.js';
import { ProbeModule } from './support/probe/probe.module.js';

const test = integrationTest({ imports: [ProbeModule] });

describe('URI versioning', () => {
  test('serves a controller without an explicit version under /v1', async ({ http }) => {
    const response = await http.get('/v1/probe/books').query({ limit: 5 });

    expect(response.status).toBe(200);
  });

  test('does not serve a versioned route without the version prefix', async ({ http }) => {
    const response = await http.get('/probe/books').query({ limit: 5 });

    expect(response.status).toBe(404);
  });

  test('does not serve a version that does not exist', async ({ http }) => {
    const response = await http.get('/v2/probe/books').query({ limit: 5 });

    expect(response.status).toBe(404);
  });
});
