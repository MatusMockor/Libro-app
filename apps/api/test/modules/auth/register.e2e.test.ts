import { createHash } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { verify } from '@node-rs/argon2';
import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type { AuthSessionResponse } from '../../../src/modules/auth/http/auth-session.response.js';
import type { UserResponse } from '../../../src/modules/auth/http/user.response.js';
import { integrationTest } from '../../support/integration-test.js';
import { ANY_UUID } from '../../support/matchers.js';
import { ProbeAuthSubscriberModule } from '../../support/probe-events/auth/probe-auth-subscriber.module.js';
import { ProbeEventRecorder } from '../../support/probe-events/subscriber/probe-event-recorder.js';

const ROUTE = '/v1/auth/register';

const PASSWORD = 'a quiet afternoon with a book';

const READER = { email: 'ann.reader@example.test', password: PASSWORD };

const test = integrationTest({ imports: [ProbeAuthSubscriberModule] }).extend(
  'recorder',
  ({ app }) => {
    const recorder = app.get(ProbeEventRecorder);
    recorder.clear();

    return recorder;
  },
);

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
}

function storedUsers(dataSource: DataSource): Promise<StoredUser[]> {
  return dataSource.query<StoredUser[]>(
    'SELECT id, email, password_hash AS "passwordHash" FROM auth.users ORDER BY email',
  );
}

describe('POST /v1/auth/register', () => {
  test('answers 201 with the new user and an access token', async ({ http }) => {
    const response = await http.post(ROUTE).send(READER);

    expect(response.status).toBe(201);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toStrictEqual({
      user: { id: ANY_UUID, email: READER.email },
      accessToken: expect.stringMatching(/^[\w-]+\.[\w-]+\.[\w-]+$/) as string,
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) as string,
      refreshTokenExpiresIn: expect.any(Number) as number,
    });
    expect((response.body as AuthSessionResponse).refreshTokenExpiresIn).toBeGreaterThan(
      30 * 24 * 60 * 60 - 60,
    );
    expect((response.body as AuthSessionResponse).refreshTokenExpiresIn).toBeLessThanOrEqual(
      30 * 24 * 60 * 60,
    );
  });

  test('stores the normalised email and an argon2id hash instead of the password', async ({
    http,
    dataSource,
  }) => {
    const session = (
      await http.post(ROUTE).send({ email: '  Ann.Reader@Example.TEST ', password: PASSWORD })
    ).body as AuthSessionResponse;

    const [stored, ...others] = await storedUsers(dataSource);

    expect(others).toEqual([]);
    expect(session.user).toStrictEqual({ id: stored?.id, email: 'ann.reader@example.test' });
    expect(stored?.email).toBe('ann.reader@example.test');
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(stored?.passwordHash).not.toContain(PASSWORD);
    expect(await verify(stored?.passwordHash ?? '', PASSWORD)).toBe(true);
  });

  test('starts a session that stores only the hash of the refresh token', async ({
    http,
    dataSource,
  }) => {
    const before = Date.now();
    const session = (await http.post(ROUTE).send(READER)).body as AuthSessionResponse;

    const rows = await dataSource.query<
      { userId: string; expiresAt: Date; tokenHash: string; dump: string }[]
    >(
      `SELECT session.user_id AS "userId", session.expires_at AS "expiresAt",
              token.token_hash AS "tokenHash", row_to_json(token)::text || row_to_json(session)::text AS dump
       FROM auth.sessions session
       JOIN auth.refresh_tokens token ON token.session_id = session.id`,
    );
    const [stored, ...others] = rows;

    expect(others).toEqual([]);
    expect(stored?.userId).toBe(session.user.id);
    expect(stored?.tokenHash).toBe(createHash('sha256').update(session.refreshToken).digest('hex'));
    expect(stored?.dump).not.toContain(session.refreshToken);
    expect(stored?.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 30 * 24 * 3600 * 1000);
    expect(stored?.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 30 * 24 * 3600 * 1000);
  });

  test('publishes UserRegistered once with only the user id', async ({ http, recorder }) => {
    const session = (await http.post(ROUTE).send(READER)).body as AuthSessionResponse;

    expect(recorder.all()).toEqual([
      {
        handler: 'auth.v1',
        event: {
          name: 'UserRegistered',
          version: 1,
          occurredAt: expect.any(Date) as Date,
          payload: { userId: session.user.id },
        },
      },
    ]);
  });

  test('issues an access token that signs the new user in', async ({ http }) => {
    const session = (await http.post(ROUTE).send(READER)).body as AuthSessionResponse;

    const me = await http.get('/v1/me').set('Authorization', `Bearer ${session.accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body as UserResponse).toStrictEqual(session.user);
  });

  test('puts only the user id and standard claims into the access token', async ({ http }) => {
    const session = (await http.post(ROUTE).send(READER)).body as AuthSessionResponse;

    const claims = new JwtService().decode<Record<string, unknown>>(session.accessToken, {
      complete: true,
    });
    const iat = claims.payload.iat as number;

    expect(claims.header).toStrictEqual({ alg: 'HS256', typ: 'JWT' });
    expect(claims.payload).toStrictEqual({
      sub: session.user.id,
      iss: 'libro-api',
      aud: 'libro-app',
      iat: expect.any(Number) as number,
      exp: iat + 900,
    });
  });

  test.for([
    { password: '📚'.repeat(10), name: 'ten emoji' },
    { password: 'x'.repeat(128), name: '128 characters' },
    { password: '😀'.repeat(128), name: '128 emoji' },
  ])('accepts a password of $name', async ({ password }, { http }) => {
    const response = await http.post(ROUTE).send({ ...READER, password });

    expect(response.status).toBe(201);
  });

  test.for([
    {
      problem: 'a missing email',
      body: { password: PASSWORD },
      errors: [{ path: 'email', code: 'invalid_type' }],
    },
    {
      problem: 'an invalid email',
      body: { email: 'ann.reader', password: PASSWORD },
      errors: [{ path: 'email', code: 'invalid_format' }],
    },
    {
      problem: 'an email longer than 254 characters',
      body: { email: `${'a'.repeat(243)}@example.test`, password: PASSWORD },
      errors: [{ path: 'email', code: 'too_big' }],
    },
    {
      problem: 'a missing password',
      body: { email: READER.email },
      errors: [{ path: 'password', code: 'invalid_type' }],
    },
    {
      problem: 'a password of 9 characters',
      body: { email: READER.email, password: '123456789' },
      errors: [{ path: 'password', code: 'too_small' }],
    },
    {
      problem: 'a password of 9 emoji',
      body: { email: READER.email, password: '📚'.repeat(9) },
      errors: [{ path: 'password', code: 'too_small' }],
    },
    {
      problem: 'a password of 129 characters',
      body: { email: READER.email, password: 'x'.repeat(129) },
      errors: [{ path: 'password', code: 'too_big' }],
    },
  ])(
    'rejects $problem with 400 and stores nothing',
    async ({ body, errors }, { http, dataSource, recorder }) => {
      const response = await http.post(ROUTE).send(body);
      const problem = response.body as ProblemDetails;

      expect(response.status).toBe(400);
      expect(problem.code).toBe('validation_failed');
      expect(problem.errors?.map(({ path, code }) => ({ path, code }))).toEqual(errors);
      expect(JSON.stringify(problem)).not.toContain(PASSWORD);
      expect(await storedUsers(dataSource)).toEqual([]);
      expect(recorder.all()).toEqual([]);
    },
  );

  test('answers 409 email_already_registered for an email that differs only in case', async ({
    http,
    dataSource,
    recorder,
    signIn,
  }) => {
    await signIn({ email: READER.email });

    const response = await http
      .post(ROUTE)
      .send({ email: 'ANN.Reader@example.test', password: PASSWORD });

    expect(response.status).toBe(409);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'An account with this email already exists.',
      instance: ROUTE,
      code: 'email_already_registered',
    });
    expect((await storedUsers(dataSource)).map(({ email }) => email)).toEqual([READER.email]);
    expect(recorder.all()).toEqual([]);
  });

  test('answers 409 to the loser of two concurrent registrations with the same email', async ({
    http,
    dataSource,
    recorder,
  }) => {
    const responses = await Promise.all([
      http.post(ROUTE).send(READER),
      http.post(ROUTE).send({ ...READER, email: READER.email.toUpperCase() }),
    ]);

    expect(responses.map(({ status }) => status).toSorted()).toEqual([201, 409]);
    expect(await storedUsers(dataSource)).toHaveLength(1);
    expect(recorder.all()).toHaveLength(1);
  });
});
