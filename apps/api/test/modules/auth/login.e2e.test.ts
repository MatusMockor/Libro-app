import { describe, expect, onTestFinished, vi } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../../../src/modules/auth/application/password-hasher.js';
import {
  FACTORY_USER_PASSWORD,
  type UserFactoryMeta,
} from '../../../src/modules/auth/factories/user.factory.js';
import type { AuthSessionResponse } from '../../../src/modules/auth/http/auth-session.response.js';
import type { UserResponse } from '../../../src/modules/auth/http/user.response.js';
import { UserEntity } from '../../../src/modules/auth/persistence/user.entity.js';
import { test } from '../../support/integration-test.js';

const ROUTE = '/v1/auth/login';

const EMAIL = 'ann.reader@example.test';

const INVALID_CREDENTIALS = {
  type: 'about:blank',
  title: 'Unauthorized',
  status: 401,
  detail: 'The email or password is incorrect.',
  instance: ROUTE,
  code: 'invalid_credentials',
};

describe('POST /v1/auth/login', () => {
  test('answers 200 with the user and an access token', async ({ http, signIn }) => {
    const user = await signIn({ email: EMAIL });

    const response = await http.post(ROUTE).send({ email: EMAIL, password: FACTORY_USER_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toStrictEqual({
      user: { id: user.id, email: EMAIL },
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

  test('issues an access token that signs the user in', async ({ http, signIn }) => {
    const user = await signIn({ email: EMAIL });
    const session = (await http.post(ROUTE).send({ email: EMAIL, password: FACTORY_USER_PASSWORD }))
      .body as AuthSessionResponse;

    const me = await http.get('/v1/me').set('Authorization', `Bearer ${session.accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body as UserResponse).toStrictEqual({ id: user.id, email: EMAIL });
  });

  test('matches the email case-insensitively and without surrounding spaces', async ({
    http,
    signIn,
  }) => {
    await signIn({ email: EMAIL });

    const response = await http
      .post(ROUTE)
      .send({ email: '  ANN.Reader@Example.test ', password: FACTORY_USER_PASSWORD });

    expect(response.status).toBe(200);
  });

  test('compares passwords after Unicode normalisation', async ({ http }) => {
    await http.post('/v1/auth/register').send({ email: EMAIL, password: 'café au lait, please' });

    const response = await http
      .post(ROUTE)
      .send({ email: EMAIL, password: 'café au lait, please' });

    expect(response.status).toBe(200);
  });

  test('answers a wrong password and an unknown email with the same 401', async ({
    http,
    signIn,
  }) => {
    await signIn({ email: EMAIL });

    const wrongPassword = await http
      .post(ROUTE)
      .send({ email: EMAIL, password: `${FACTORY_USER_PASSWORD}!` });
    const unknownEmail = await http
      .post(ROUTE)
      .send({ email: 'nobody@example.test', password: FACTORY_USER_PASSWORD });

    for (const response of [wrongPassword, unknownEmail]) {
      expect(response.status).toBe(401);
      expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(response.headers['www-authenticate']).toBeUndefined();
      expect(response.body).toStrictEqual(INVALID_CREDENTIALS);
    }
  });

  test('answers a user without a password like a wrong password, after the same hashing work', async ({
    app,
    http,
    factories,
  }) => {
    await factories
      .get<UserEntity, UserFactoryMeta>(UserEntity)
      .setMeta({ email: EMAIL, withoutPassword: true })
      .save();
    const verifying = vi.spyOn(app.get<PasswordHasher>(PASSWORD_HASHER), 'verify');
    onTestFinished(() => {
      verifying.mockRestore();
    });

    const response = await http.post(ROUTE).send({ email: EMAIL, password: FACTORY_USER_PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual(INVALID_CREDENTIALS);
    expect(verifying).toHaveBeenCalledOnce();
  });

  test('does not apply the registration password rules to a login', async ({ http, signIn }) => {
    await signIn({ email: EMAIL });

    const response = await http.post(ROUTE).send({ email: EMAIL, password: 'short' });

    expect(response.status).toBe(401);
    expect((response.body as ProblemDetails).code).toBe('invalid_credentials');
  });

  test.for([
    {
      problem: 'a missing email',
      body: { password: FACTORY_USER_PASSWORD },
      errors: [{ path: 'email', code: 'invalid_type' }],
    },
    {
      problem: 'an invalid email',
      body: { email: 'ann.reader', password: FACTORY_USER_PASSWORD },
      errors: [{ path: 'email', code: 'invalid_format' }],
    },
    {
      problem: 'an empty password',
      body: { email: EMAIL, password: '' },
      errors: [{ path: 'password', code: 'too_small' }],
    },
    {
      problem: 'a password longer than 1024 characters',
      body: { email: EMAIL, password: 'x'.repeat(1025) },
      errors: [{ path: 'password', code: 'too_big' }],
    },
  ])('rejects $problem with 400', async ({ body, errors }, { http }) => {
    const response = await http.post(ROUTE).send(body);
    const problem = response.body as ProblemDetails;

    expect(response.status).toBe(400);
    expect(problem.code).toBe('validation_failed');
    expect(problem.errors?.map(({ path, code }) => ({ path, code }))).toEqual(errors);
  });
});
