import { ThrottlerStorage } from '@nestjs/throttler';
import { describe, expect, vi } from 'vitest';

vi.stubEnv('AUTH_RATE_LIMIT_MAX', '2');
vi.stubEnv('AUTH_RATE_LIMIT_WINDOW_SECONDS', '60');
vi.stubEnv('TRUST_PROXY', '');

const { integrationTest } = await import('../../support/integration-test.js');
const { ResettableThrottlerStorage } =
  await import('../../support/resettable-throttler-storage.js');
const { FACTORY_USER_PASSWORD } =
  await import('../../../src/modules/auth/factories/user.factory.js');
const { GOOGLE_NONCE_ROUTE, GOOGLE_SIGN_IN_ROUTE, useLocalGoogleSigningKeys } =
  await import('../../support/google-sign-in.js');

const storage = new ResettableThrottlerStorage();

const test = integrationTest({
  configure: (builder) =>
    useLocalGoogleSigningKeys(builder).overrideProvider(ThrottlerStorage).useValue(storage),
}).extend('rateLimits', { auto: true }, () => {
  storage.reset();
});

const REGISTER = '/v1/auth/register';
const LOGIN = '/v1/auth/login';
const REFRESH = '/v1/auth/refresh';
const LOGOUT = '/v1/auth/logout';
const DELETION = '/v1/me/deletion';

function tooManyRequests(instance: string) {
  return {
    type: 'about:blank',
    title: 'Too Many Requests',
    status: 429,
    detail: 'Too many attempts. Try again later.',
    instance,
    code: 'too_many_requests',
  };
}

function registration(serial: number) {
  return { email: `reader-${String(serial)}@example.test`, password: FACTORY_USER_PASSWORD };
}

describe('auth rate limit', () => {
  test('answers 429 with Retry-After once a client exceeds the register limit', async ({
    http,
    dataSource,
  }) => {
    const allowed = [
      await http.post(REGISTER).send(registration(1)),
      await http.post(REGISTER).send(registration(2)),
    ];

    const limited = await http.post(REGISTER).send(registration(3));

    expect(allowed.map(({ status }) => status)).toEqual([201, 201]);
    expect(limited.status).toBe(429);
    expect(limited.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(limited.headers['retry-after'])).toBeLessThanOrEqual(60);
    expect(limited.body).toStrictEqual(tooManyRequests(REGISTER));
    expect(
      await dataSource.query<{ email: string }[]>('SELECT email FROM auth.users ORDER BY email'),
    ).toEqual([{ email: 'reader-1@example.test' }, { email: 'reader-2@example.test' }]);
  });

  test('counts rejected login attempts and answers 429 once the limit is exceeded', async ({
    http,
    signIn,
  }) => {
    const user = await signIn();
    const wrong = { email: user.email, password: 'not the password' };

    const attempts = [await http.post(LOGIN).send(wrong), await http.post(LOGIN).send(wrong)];
    const limited = await http
      .post(LOGIN)
      .send({ email: user.email, password: FACTORY_USER_PASSWORD });

    expect(attempts.map(({ status }) => status)).toEqual([401, 401]);
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toMatch(/^\d+$/);
    expect(limited.body).toStrictEqual(tooManyRequests(LOGIN));
  });

  test.for([REFRESH, LOGOUT])(
    'answers 429 on %s once the limit is exceeded',
    async (route, { http }) => {
      const unknown = { refreshToken: 'C'.repeat(43) };

      const attempts = [await http.post(route).send(unknown), await http.post(route).send(unknown)];
      const limited = await http.post(route).send(unknown);

      expect(attempts.map(({ status }) => status)).not.toContain(429);
      expect(limited.status).toBe(429);
      expect(limited.headers['retry-after']).toMatch(/^\d+$/);
      expect(limited.body).toStrictEqual(tooManyRequests(route));
    },
  );

  test('answers 429 on the Google nonce route once the limit is exceeded', async ({ http }) => {
    const allowed = [await http.post(GOOGLE_NONCE_ROUTE), await http.post(GOOGLE_NONCE_ROUTE)];

    const limited = await http.post(GOOGLE_NONCE_ROUTE);

    expect(allowed.map(({ status }) => status)).toEqual([201, 201]);
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toMatch(/^\d+$/);
    expect(limited.body).toStrictEqual(tooManyRequests(GOOGLE_NONCE_ROUTE));
  });

  test('counts rejected Google sign-ins and answers 429 once the limit is exceeded', async ({
    http,
  }) => {
    const rejected = { idToken: 'eyJhbGciOiJSUzI1NiJ9.e30.c2lnbmF0dXJl' };

    const attempts = [
      await http.post(GOOGLE_SIGN_IN_ROUTE).send(rejected),
      await http.post(GOOGLE_SIGN_IN_ROUTE).send(rejected),
    ];
    const limited = await http.post(GOOGLE_SIGN_IN_ROUTE).send(rejected);

    expect(attempts.map(({ status }) => status)).toEqual([401, 401]);
    expect(limited.status).toBe(429);
    expect(limited.body).toStrictEqual(tooManyRequests(GOOGLE_SIGN_IN_ROUTE));
  });

  test('counts rejected account deletions and answers 429 once the limit is exceeded', async ({
    http,
    signIn,
    dataSource,
  }) => {
    const user = await signIn();
    const deletion = (password: string) =>
      http.post(DELETION).set('Authorization', user.authorization).send({ password });

    const attempts = [await deletion('not the password'), await deletion('not the password')];
    const limited = await deletion(FACTORY_USER_PASSWORD);

    expect(attempts.map(({ status }) => status)).toEqual([401, 401]);
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toMatch(/^\d+$/);
    expect(limited.body).toStrictEqual(tooManyRequests(DELETION));
    expect(
      await dataSource.query<{ id: string }[]>('SELECT id FROM auth.users WHERE id = $1', [
        user.id,
      ]),
    ).toEqual([{ id: user.id }]);
  });

  test('limits register and login separately', async ({ http, signIn }) => {
    const user = await signIn();
    const login = { email: user.email, password: FACTORY_USER_PASSWORD };

    await http.post(REGISTER).send(registration(1));
    await http.post(REGISTER).send(registration(2));
    const limitedRegister = await http.post(REGISTER).send(registration(3));
    const logins = [await http.post(LOGIN).send(login), await http.post(LOGIN).send(login)];

    expect(limitedRegister.status).toBe(429);
    expect(logins.map(({ status }) => status)).toEqual([200, 200]);
  });

  test('ignores X-Forwarded-For when TRUST_PROXY is not set', async ({ http }) => {
    const statuses = [];
    for (const [serial, client] of ['203.0.113.1', '203.0.113.2', '203.0.113.3'].entries()) {
      const response = await http
        .post(REGISTER)
        .set('X-Forwarded-For', client)
        .send(registration(serial + 1));
      statuses.push(response.status);
    }

    expect(statuses).toEqual([201, 201, 429]);
  });

  test('does not limit other routes', async ({ http, signIn }) => {
    const user = await signIn();

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => http.get('/v1/me').set('Authorization', user.authorization)),
    );

    expect(responses.map(({ status }) => status)).toEqual([200, 200, 200, 200, 200]);
  });
});
