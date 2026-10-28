import { describe, expect } from 'vitest';
import { LoginService } from '../../../src/modules/auth/application/login.service.js';
import { RegisterService } from '../../../src/modules/auth/application/register.service.js';
import type { UserResponse } from '../../../src/modules/auth/http/user.response.js';
import { test } from '../../support/integration-test.js';

const DECOMPOSED_PASSWORD = 'café au lait, please';
const COMPOSED_PASSWORD = 'café au lait, please';

describe('credential normalisation in the auth services', () => {
  test('registers with a normalised email and password when called without the HTTP schema', async ({
    app,
    http,
    dataSource,
  }) => {
    const session = await app
      .get(RegisterService)
      .register({ email: '  Reader@Example.COM ', password: DECOMPOSED_PASSWORD });

    const stored = await dataSource.query<{ email: string }[]>('SELECT email FROM auth.users');
    const login = await http
      .post('/v1/auth/login')
      .send({ email: 'reader@example.com', password: COMPOSED_PASSWORD });

    expect(session.user.email).toBe('reader@example.com');
    expect(stored).toEqual([{ email: 'reader@example.com' }]);
    expect(login.status).toBe(200);
    expect((login.body as { user: UserResponse }).user).toStrictEqual(session.user);
  });

  test('logs in with credentials that are not normalised yet', async ({ app, http }) => {
    await http
      .post('/v1/auth/register')
      .send({ email: 'reader@example.com', password: COMPOSED_PASSWORD });

    const session = await app
      .get(LoginService)
      .login({ email: ' READER@example.com', password: DECOMPOSED_PASSWORD });

    expect(session.user.email).toBe('reader@example.com');
  });
});
