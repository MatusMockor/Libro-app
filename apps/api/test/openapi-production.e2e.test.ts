import { describe, expect, vi } from 'vitest';

vi.stubEnv('NODE_ENV', 'production');
vi.stubEnv('JWT_ACCESS_SECRET', 'a-production-like-secret-for-the-openapi-test');
vi.stubEnv('MEDIA_URL_SIGNING_SECRET', 'a-production-like-media-secret-for-the-openapi-test');

const { test } = await import('./support/integration-test.js');

describe('OpenAPI in production', () => {
  test('does not serve the docs', async ({ http }) => {
    const ui = await http.get('/docs');
    const document = await http.get('/docs-json');

    expect(ui.status).toBe(404);
    expect(document.status).toBe(404);
    expect(document.headers['content-type']).toMatch(/^application\/problem\+json/);
  });
});
