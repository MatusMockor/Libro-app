import { describe, expect, vi } from 'vitest';

vi.stubEnv('GOOGLE_CLIENT_IDS', ' , ');

const { integrationTest } = await import('../../support/integration-test.js');
const {
  GOOGLE_NONCE_ROUTE,
  GOOGLE_SIGN_IN_ROUTE,
  googleClaims,
  googleIdToken,
  useLocalGoogleSigningKeys,
} = await import('../../support/google-sign-in.js');

const test = integrationTest({ configure: useLocalGoogleSigningKeys });

function notConfigured(instance: string) {
  return {
    type: 'about:blank',
    title: 'Service Unavailable',
    status: 503,
    detail: 'Service Unavailable',
    instance,
    code: 'identity_provider_not_configured',
  };
}

describe('Google sign-in without GOOGLE_CLIENT_IDS', () => {
  test('answers 503 identity_provider_not_configured for a nonce', async ({ http, dataSource }) => {
    const response = await http.post(GOOGLE_NONCE_ROUTE);

    expect(response.status).toBe(503);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toStrictEqual(notConfigured(GOOGLE_NONCE_ROUTE));
    expect(await dataSource.query('SELECT 1 FROM auth.sign_in_nonces')).toEqual([]);
  });

  test('answers 503 identity_provider_not_configured for a sign-in', async ({ http }) => {
    const idToken = await googleIdToken(googleClaims('C'.repeat(43)));

    const response = await http.post(GOOGLE_SIGN_IN_ROUTE).send({ idToken });

    expect(response.status).toBe(503);
    expect(response.body).toStrictEqual(notConfigured(GOOGLE_SIGN_IN_ROUTE));
  });

  test('keeps email sign-in working', async ({ http }) => {
    const response = await http
      .post('/v1/auth/register')
      .send({ email: 'ann.reader@example.test', password: 'a quiet afternoon with a book' });

    expect(response.status).toBe(201);
  });
});
