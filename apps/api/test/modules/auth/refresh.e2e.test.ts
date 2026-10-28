import { ConsoleLogger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { describe, expect, onTestFinished } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import { FACTORY_USER_PASSWORD } from '../../../src/modules/auth/factories/user.factory.js';
import type { AuthSessionResponse } from '../../../src/modules/auth/http/auth-session.response.js';
import { CapturingLogger } from '../../support/capturing-logger.js';
import { test as base } from '../../support/integration-test.js';
import { lockSession, requestsWaitingForSessionLock } from '../../support/session-lock.js';

const ROUTE = '/v1/auth/refresh';

const INVALID_REFRESH_TOKEN = {
  type: 'about:blank',
  title: 'Unauthorized',
  status: 401,
  detail: 'The refresh token is invalid, expired or revoked. Sign in again.',
  instance: ROUTE,
  code: 'invalid_refresh_token',
};

const test = base.extend(
  'refresh',
  ({ http }) =>
    (refreshToken: string) =>
      http.post(ROUTE).send({ refreshToken }),
);

interface StoredSession {
  id: string;
  expiresAt: Date;
  revoked: boolean;
}

async function storedSessions(dataSource: DataSource): Promise<StoredSession[]> {
  return dataSource.query<StoredSession[]>(
    `SELECT id, expires_at AS "expiresAt", revoked_at IS NOT NULL AS revoked
     FROM auth.sessions ORDER BY created_at`,
  );
}

async function tokenStates(dataSource: DataSource): Promise<boolean[]> {
  const rows = await dataSource.query<{ revoked: boolean }[]>(
    'SELECT revoked_at IS NOT NULL AS revoked FROM auth.refresh_tokens ORDER BY created_at, id',
  );

  return rows.map(({ revoked }) => revoked);
}

describe('POST /v1/auth/refresh', () => {
  test('answers 200 with new tokens for the same user', async ({ refresh, signIn }) => {
    const user = await signIn();

    const response = await refresh(user.refreshToken);
    const session = response.body as AuthSessionResponse;

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      user: { id: user.id, email: user.email },
      accessToken: expect.stringMatching(/^[\w-]+\.[\w-]+\.[\w-]+$/) as string,
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) as string,
      refreshTokenExpiresIn: expect.any(Number) as number,
    });
    expect(session.refreshToken).not.toBe(user.refreshToken);
    expect(session.refreshTokenExpiresIn).toBeLessThanOrEqual(30 * 24 * 60 * 60);
    expect(session.refreshTokenExpiresIn).toBeGreaterThan(30 * 24 * 60 * 60 - 60);
  });

  test('issues an access token that works on GET /v1/me', async ({ http, refresh, signIn }) => {
    const user = await signIn();
    const session = (await refresh(user.refreshToken)).body as AuthSessionResponse;

    const me = await http.get('/v1/me').set('Authorization', `Bearer ${session.accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body).toStrictEqual({ id: user.id, email: user.email });
  });

  test('uses up the presented token and keeps the replacement in the same session', async ({
    refresh,
    signIn,
    dataSource,
  }) => {
    const user = await signIn();

    await refresh(user.refreshToken);

    const sessionIds = await dataSource.query<{ sessionId: string }[]>(
      'SELECT DISTINCT session_id AS "sessionId" FROM auth.refresh_tokens',
    );
    expect(sessionIds).toHaveLength(1);
    expect(await tokenStates(dataSource)).toEqual([true, false]);
  });

  test('never extends the expiry of the session', async ({ refresh, signIn, dataSource }) => {
    const user = await signIn();
    const [started] = await storedSessions(dataSource);

    let refreshToken = user.refreshToken;
    const expiresIn: number[] = [];
    for (let rotation = 0; rotation < 3; rotation += 1) {
      const session = (await refresh(refreshToken)).body as AuthSessionResponse;
      refreshToken = session.refreshToken;
      expiresIn.push(session.refreshTokenExpiresIn);
    }

    const [rotated, ...others] = await storedSessions(dataSource);
    expect(others).toEqual([]);
    expect(rotated?.expiresAt).toEqual(started?.expiresAt);
    expect(expiresIn).toEqual(expiresIn.toSorted((left, right) => right - left));
    expect(await tokenStates(dataSource)).toEqual([true, true, true, false]);
  });

  test('ends the whole session when a used token is presented again', async ({
    app,
    refresh,
    signIn,
    dataSource,
  }) => {
    const logger = new CapturingLogger();
    app.useLogger(logger);
    onTestFinished(() => {
      app.useLogger(new ConsoleLogger());
    });
    const user = await signIn();
    const newest = ((await refresh(user.refreshToken)).body as AuthSessionResponse).refreshToken;

    const reused = await refresh(user.refreshToken);
    const afterReuse = await refresh(newest);

    const [session] = await storedSessions(dataSource);
    expect(reused.status).toBe(401);
    expect(reused.body).toStrictEqual(INVALID_REFRESH_TOKEN);
    expect(afterReuse.status).toBe(401);
    expect(afterReuse.body).toStrictEqual(INVALID_REFRESH_TOKEN);
    expect(session?.revoked).toBe(true);
    expect(logger.warnings).toEqual([
      `Refresh token reuse detected, revoked session ${session?.id ?? ''}`,
    ]);
    expect(logger.warnings.join()).not.toContain(user.refreshToken);
  });

  test('keeps the other sessions of the user when one session is ended by reuse', async ({
    http,
    refresh,
    signIn,
  }) => {
    const user = await signIn();
    const other = (
      await http.post('/v1/auth/login').send({ email: user.email, password: FACTORY_USER_PASSWORD })
    ).body as AuthSessionResponse;
    await refresh(user.refreshToken);

    await refresh(user.refreshToken);
    const response = await refresh(other.refreshToken);

    expect(response.status).toBe(200);
  });

  test('lets only one of two refreshes with the same token win, then ends the session', async ({
    refresh,
    signIn,
    dataSource,
  }) => {
    const user = await signIn();
    const [session] = await storedSessions(dataSource);
    const lock = await lockSession(dataSource, session?.id ?? '');

    const racing = [refresh(user.refreshToken).then(), refresh(user.refreshToken).then()];
    const waiting = await requestsWaitingForSessionLock(dataSource, 2);
    await lock.commit();
    const responses = await Promise.all(racing);
    const winner = responses.find(({ status }) => status === 200)?.body as
      AuthSessionResponse | undefined;
    const afterRace = await refresh(winner?.refreshToken ?? '');

    expect(waiting).toBe(2);
    expect(responses.map(({ status }) => status).toSorted()).toEqual([200, 401]);
    expect(responses.find(({ status }) => status === 401)?.body).toStrictEqual(
      INVALID_REFRESH_TOKEN,
    );
    expect((await storedSessions(dataSource)).map(({ revoked }) => revoked)).toEqual([true]);
    expect(afterRace.status).toBe(401);
  });

  test('answers 401 when the session is ended while the refresh waits for it', async ({
    refresh,
    signIn,
    dataSource,
  }) => {
    const user = await signIn();
    const [session] = await storedSessions(dataSource);
    const lock = await lockSession(dataSource, session?.id ?? '');

    const pending = refresh(user.refreshToken).then();
    const waiting = await requestsWaitingForSessionLock(dataSource, 1);
    await lock.connection.query('UPDATE auth.sessions SET revoked_at = now() WHERE id = $1', [
      session?.id,
    ]);
    await lock.commit();
    const response = await pending;

    expect(waiting).toBe(1);
    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual(INVALID_REFRESH_TOKEN);
    expect(await tokenStates(dataSource)).toEqual([false]);
  });

  test('answers 401 when the session expires while the refresh waits for it', async ({
    refresh,
    signIn,
    dataSource,
  }) => {
    const user = await signIn();
    const [session] = await storedSessions(dataSource);
    const lock = await lockSession(dataSource, session?.id ?? '');

    const pending = refresh(user.refreshToken).then();
    const waiting = await requestsWaitingForSessionLock(dataSource, 1);
    await lock.connection.query(
      "UPDATE auth.sessions SET expires_at = clock_timestamp() + interval '50 milliseconds' WHERE id = $1",
      [session?.id],
    );
    await lock.connection.query('SELECT pg_sleep(0.1)');
    await lock.commit();
    const response = await pending;

    expect(waiting).toBe(1);
    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual(INVALID_REFRESH_TOKEN);
    expect(await tokenStates(dataSource)).toEqual([false]);
    expect((await storedSessions(dataSource)).map(({ revoked }) => revoked)).toEqual([false]);
  });

  test('answers 401 for the newest token of a session past its absolute expiry', async ({
    refresh,
    signIn,
    dataSource,
  }) => {
    const user = await signIn();
    const newest = ((await refresh(user.refreshToken)).body as AuthSessionResponse).refreshToken;
    await dataSource.query("UPDATE auth.sessions SET expires_at = now() - interval '1 second'");

    const response = await refresh(newest);

    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual(INVALID_REFRESH_TOKEN);
    expect(await tokenStates(dataSource)).toEqual([true, false]);
  });

  test('answers 401 for a well-formed token it never issued', async ({ refresh, signIn }) => {
    await signIn();

    const response = await refresh('A'.repeat(43));

    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual(INVALID_REFRESH_TOKEN);
  });

  test('needs no access token, also not an expired one', async ({ http, signIn }) => {
    const user = await signIn();

    const response = await http
      .post(ROUTE)
      .set('Authorization', 'Bearer expired.or.invalid')
      .send({ refreshToken: user.refreshToken });

    expect(response.status).toBe(200);
  });

  test.for([
    { problem: 'a missing refresh token', body: {}, code: 'invalid_type' },
    { problem: 'a refresh token of the wrong length', body: { refreshToken: 'A'.repeat(42) } },
    { problem: 'a refresh token that is not base64url', body: { refreshToken: '+'.repeat(43) } },
    {
      problem: 'a refresh token that is not a string',
      body: { refreshToken: 42 },
      code: 'invalid_type',
    },
  ])('rejects $problem with 400', async ({ body, code = 'invalid_format' }, { http }) => {
    const response = await http.post(ROUTE).send(body);
    const problem = response.body as ProblemDetails;

    expect(response.status).toBe(400);
    expect(problem.code).toBe('validation_failed');
    expect(problem.errors?.map((error) => ({ path: error.path, code: error.code }))).toEqual([
      { path: 'refreshToken', code },
    ]);
  });
});
