import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import { test } from '../../support/integration-test.js';

const ROUTE = '/v1/me';

describe('GET /v1/me', () => {
  test('answers 200 with the signed-in user', async ({ http, signIn }) => {
    const user = await signIn({ email: 'ann.reader@example.test' });

    const response = await http.get(ROUTE).set('Authorization', user.authorization);

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ id: user.id, email: 'ann.reader@example.test' });
  });

  test('answers 401 authentication_required without an access token', async ({ http, signIn }) => {
    await signIn();

    const response = await http.get(ROUTE);

    expect(response.status).toBe(401);
    expect(response.headers['www-authenticate']).toBe('Bearer');
    expect((response.body as ProblemDetails).code).toBe('authentication_required');
  });

  test('answers 401 invalid_access_token when the account no longer exists', async ({
    http,
    signIn,
    dataSource,
  }) => {
    const user = await signIn();
    await dataSource.query('DELETE FROM auth.users WHERE id = $1', [user.id]);

    const response = await http.get(ROUTE).set('Authorization', user.authorization);

    expect(response.status).toBe(401);
    expect(response.headers['www-authenticate']).toBe('Bearer error="invalid_token"');
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Unauthorized',
      status: 401,
      detail: 'The access token is invalid or expired.',
      instance: ROUTE,
      code: 'invalid_access_token',
    });
  });
});
