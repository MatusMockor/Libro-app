import { ThrottlerStorage } from '@nestjs/throttler';
import { describe, expect, vi } from 'vitest';

vi.stubEnv('AUTH_RATE_LIMIT_MAX', '2');
vi.stubEnv('AUTH_RATE_LIMIT_WINDOW_SECONDS', '60');
vi.stubEnv('TRUST_PROXY', '1');

const { integrationTest } = await import('../../support/integration-test.js');
const { ResettableThrottlerStorage } =
  await import('../../support/resettable-throttler-storage.js');
const { FACTORY_USER_PASSWORD } =
  await import('../../../src/modules/auth/factories/user.factory.js');

const storage = new ResettableThrottlerStorage();

const test = integrationTest({
  configure: (builder) => builder.overrideProvider(ThrottlerStorage).useValue(storage),
}).extend('rateLimits', { auto: true }, () => {
  storage.reset();
});

const LOGIN = '/v1/auth/login';

const FIRST_CLIENT = '203.0.113.10';
const SECOND_CLIENT = '198.51.100.20';

describe('auth rate limit behind a trusted proxy', () => {
  test('gives every forwarded client IP its own bucket', async ({ http, signIn }) => {
    const user = await signIn();
    const login = (client: string) =>
      http
        .post(LOGIN)
        .set('X-Forwarded-For', client)
        .send({ email: user.email, password: FACTORY_USER_PASSWORD });

    const first = [await login(FIRST_CLIENT), await login(FIRST_CLIENT)];
    const second = [await login(SECOND_CLIENT), await login(SECOND_CLIENT)];
    const limited = await login(FIRST_CLIENT);

    expect(first.map(({ status }) => status)).toEqual([200, 200]);
    expect(second.map(({ status }) => status)).toEqual([200, 200]);
    expect(limited.status).toBe(429);
  });

  test('uses the address added by the trusted proxy, not one the client sent before it', async ({
    http,
    signIn,
  }) => {
    const user = await signIn();
    const login = (forwardedFor: string) =>
      http
        .post(LOGIN)
        .set('X-Forwarded-For', forwardedFor)
        .send({ email: user.email, password: FACTORY_USER_PASSWORD });

    const statuses = [];
    for (const spoofed of ['10.0.0.1', '10.0.0.2', '10.0.0.3']) {
      statuses.push((await login(`${spoofed}, ${FIRST_CLIENT}`)).status);
    }

    expect(statuses).toEqual([200, 200, 429]);
  });
});
