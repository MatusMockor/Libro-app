import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import { FACTORY_USER_PASSWORD } from '../../../src/modules/auth/factories/user.factory.js';
import type { AuthSessionResponse } from '../../../src/modules/auth/http/auth-session.response.js';
import { test as base } from '../../support/integration-test.js';
import { lockSession, requestsWaitingForSessionLock } from '../../support/session-lock.js';

const ROUTE = '/v1/auth/logout';

const test = base.extend(
  'logout',
  ({ http }) =>
    (refreshToken: string) =>
      http.post(ROUTE).send({ refreshToken }),
);

async function revokedSessions(dataSource: DataSource): Promise<boolean[]> {
  const rows = await dataSource.query<{ revoked: boolean }[]>(
    'SELECT revoked_at IS NOT NULL AS revoked FROM auth.sessions ORDER BY created_at',
  );

  return rows.map(({ revoked }) => revoked);
}

describe('POST /v1/auth/logout', () => {
  test('answers 204 and ends the session of the refresh token', async ({
    http,
    logout,
    signIn,
    dataSource,
  }) => {
    const user = await signIn();

    const response = await logout(user.refreshToken);
    const refresh = await http.post('/v1/auth/refresh').send({ refreshToken: user.refreshToken });

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(await revokedSessions(dataSource)).toEqual([true]);
    expect(refresh.status).toBe(401);
    expect((refresh.body as ProblemDetails).code).toBe('invalid_refresh_token');
  });

  test('ends the session also through a token that was already used', async ({
    http,
    logout,
    signIn,
    dataSource,
  }) => {
    const user = await signIn();
    const newest = (
      (await http.post('/v1/auth/refresh').send({ refreshToken: user.refreshToken }))
        .body as AuthSessionResponse
    ).refreshToken;

    const response = await logout(user.refreshToken);
    const refresh = await http.post('/v1/auth/refresh').send({ refreshToken: newest });

    expect(response.status).toBe(204);
    expect(await revokedSessions(dataSource)).toEqual([true]);
    expect(refresh.status).toBe(401);
  });

  test.for([
    { name: 'an unknown refresh token', twice: false },
    { name: 'a refresh token whose session already ended', twice: true },
  ])('answers 204 for $name', async ({ twice }, { logout, signIn, dataSource }) => {
    const user = await signIn();
    const refreshToken = twice ? user.refreshToken : 'B'.repeat(43);
    if (twice) {
      await logout(refreshToken);
    }

    const response = await logout(refreshToken);

    expect(response.status).toBe(204);
    expect(await revokedSessions(dataSource)).toEqual([twice]);
  });

  test('waits for a refresh that holds the session and ends the session after it', async ({
    logout,
    signIn,
    dataSource,
  }) => {
    const user = await signIn();
    const [session] = await dataSource.query<{ id: string }[]>('SELECT id FROM auth.sessions');
    const lock = await lockSession(dataSource, session?.id ?? '');

    const pending = logout(user.refreshToken).then();
    const waiting = await requestsWaitingForSessionLock(dataSource, 1);
    const revokedWhileLocked = await revokedSessions(dataSource);
    await lock.commit();
    const response = await pending;

    expect(waiting).toBe(1);
    expect(revokedWhileLocked).toEqual([false]);
    expect(response.status).toBe(204);
    expect(await revokedSessions(dataSource)).toEqual([true]);
  });

  test('keeps the other sessions of the user', async ({ http, logout, signIn, dataSource }) => {
    const user = await signIn();
    const other = (
      await http.post('/v1/auth/login').send({ email: user.email, password: FACTORY_USER_PASSWORD })
    ).body as AuthSessionResponse;

    await logout(user.refreshToken);
    const refresh = await http.post('/v1/auth/refresh').send({ refreshToken: other.refreshToken });

    expect(await revokedSessions(dataSource)).toEqual([true, false]);
    expect(refresh.status).toBe(200);
  });

  test('needs no access token, also not an expired one', async ({ http, signIn }) => {
    const user = await signIn();

    const response = await http
      .post(ROUTE)
      .set('Authorization', 'Bearer expired.or.invalid')
      .send({ refreshToken: user.refreshToken });

    expect(response.status).toBe(204);
  });

  test('leaves issued access tokens valid until they expire', async ({ http, logout, signIn }) => {
    const user = await signIn();

    await logout(user.refreshToken);
    const me = await http.get('/v1/me').set('Authorization', user.authorization);

    expect(me.status).toBe(200);
  });

  test('rejects a malformed refresh token with 400', async ({ http }) => {
    const response = await http.post(ROUTE).send({ refreshToken: 'not-a-refresh-token' });
    const problem = response.body as ProblemDetails;

    expect(response.status).toBe(400);
    expect(problem.code).toBe('validation_failed');
    expect(problem.errors?.map(({ path, code }) => ({ path, code }))).toEqual([
      { path: 'refreshToken', code: 'invalid_format' },
    ]);
  });
});
