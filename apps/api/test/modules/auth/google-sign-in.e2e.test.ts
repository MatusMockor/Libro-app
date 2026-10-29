import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import {
  FACTORY_USER_PASSWORD,
  type UserFactoryMeta,
} from '../../../src/modules/auth/factories/user.factory.js';
import type { IdentityFactoryMeta } from '../../../src/modules/auth/factories/identity.factory.js';
import type { AuthSessionResponse } from '../../../src/modules/auth/http/auth-session.response.js';
import type { UserResponse } from '../../../src/modules/auth/http/user.response.js';
import { IdentityEntity } from '../../../src/modules/auth/persistence/identity.entity.js';
import { UserEntity } from '../../../src/modules/auth/persistence/user.entity.js';
import {
  GOOGLE_EMAIL,
  GOOGLE_SIGN_IN_ROUTE,
  GOOGLE_SUBJECT,
  googleClaims,
  googleIdToken,
} from '../../support/google-sign-in.js';
import { ANY_UUID } from '../../support/matchers.js';
import { googleSignInTest as test } from './google-sign-in.fixture.js';

const INVALID_IDENTITY_TOKEN = {
  type: 'about:blank',
  title: 'Unauthorized',
  status: 401,
  detail: 'The identity token is invalid, expired or already used. Sign in again.',
  instance: GOOGLE_SIGN_IN_ROUTE,
  code: 'invalid_identity_token',
};

const WORKSPACE_EMAIL = 'ann@libro.example.test';

const SECONDS_PER_DAY = 24 * 60 * 60;
const SESSION_LIFETIME_SECONDS = 30 * SECONDS_PER_DAY;

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string | null;
}

interface StoredIdentity {
  provider: string;
  subject: string;
  userId: string;
}

function storedUsers(dataSource: DataSource): Promise<StoredUser[]> {
  return dataSource.query<StoredUser[]>(
    'SELECT id, email, password_hash AS "passwordHash" FROM auth.users ORDER BY email',
  );
}

function storedIdentities(dataSource: DataSource): Promise<StoredIdentity[]> {
  return dataSource.query<StoredIdentity[]>(
    'SELECT provider, subject, user_id AS "userId" FROM auth.identities ORDER BY subject',
  );
}

describe('POST /v1/auth/google', () => {
  describe('a first sign-in', () => {
    test('answers 200 with a new user and our own tokens', async ({ google }) => {
      const response = await google.signIn();

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^application\/json/);
      expect(response.body).toStrictEqual({
        user: { id: ANY_UUID, email: GOOGLE_EMAIL },
        accessToken: expect.stringMatching(/^[\w-]+\.[\w-]+\.[\w-]+$/) as string,
        tokenType: 'Bearer',
        expiresIn: 900,
        refreshToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) as string,
        refreshTokenExpiresIn: expect.any(Number) as number,
      });
      expect((response.body as AuthSessionResponse).refreshTokenExpiresIn).toBeGreaterThan(
        SESSION_LIFETIME_SECONDS - 60,
      );
    });

    test('creates the user without a password and links the Google identity', async ({
      google,
      dataSource,
    }) => {
      const session = (await google.signIn({ email: '  Ann.Reader@Gmail.COM ' }))
        .body as AuthSessionResponse;

      expect(await storedUsers(dataSource)).toStrictEqual([
        { id: session.user.id, email: GOOGLE_EMAIL, passwordHash: null },
      ]);
      expect(await storedIdentities(dataSource)).toStrictEqual([
        { provider: 'google', subject: GOOGLE_SUBJECT, userId: session.user.id },
      ]);
    });

    test('creates a new user for a verified email Google is not authoritative for', async ({
      google,
      dataSource,
      recorder,
    }) => {
      const response = await google.signIn({ email: WORKSPACE_EMAIL });
      const session = response.body as AuthSessionResponse;

      expect(response.status).toBe(200);
      expect(session.user.email).toBe(WORKSPACE_EMAIL);
      expect(await storedIdentities(dataSource)).toStrictEqual([
        { provider: 'google', subject: GOOGLE_SUBJECT, userId: session.user.id },
      ]);
      expect(recorder.all()).toHaveLength(1);
    });

    test('publishes UserRegistered once with only the user id', async ({ google, recorder }) => {
      const session = (await google.signIn()).body as AuthSessionResponse;

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

    test('issues tokens that sign the user in and refresh', async ({ http, google }) => {
      const session = (await google.signIn()).body as AuthSessionResponse;

      const me = await http.get('/v1/me').set('Authorization', `Bearer ${session.accessToken}`);
      const refreshed = await http
        .post('/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken });

      expect(me.status).toBe(200);
      expect(me.body as UserResponse).toStrictEqual(session.user);
      expect(refreshed.status).toBe(200);
      expect((refreshed.body as AuthSessionResponse).user).toStrictEqual(session.user);
    });

    test.for([
      { case: 'false', claims: { email_verified: false } },
      { case: 'missing', claims: { email_verified: undefined } },
      { case: 'a string', claims: { email_verified: 'true' } },
    ])(
      'answers 403 identity_email_not_verified when email_verified is $case and stores nothing',
      async ({ claims }, { google, dataSource, recorder }) => {
        const response = await google.signIn(claims);

        expect(response.status).toBe(403);
        expect(response.body).toStrictEqual({
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          detail: 'The provider has not verified the email of this account.',
          instance: GOOGLE_SIGN_IN_ROUTE,
          code: 'identity_email_not_verified',
        });
        expect(await storedUsers(dataSource)).toEqual([]);
        expect(await storedIdentities(dataSource)).toEqual([]);
        expect(recorder.all()).toEqual([]);
      },
    );

    test('answers 403 identity_email_not_verified without an email', async ({ google }) => {
      const response = await google.signIn({ email: undefined });

      expect(response.status).toBe(403);
      expect((response.body as ProblemDetails).code).toBe('identity_email_not_verified');
    });
  });

  describe('a known Google identity', () => {
    test('signs in by subject with an email Google is not authoritative for', async ({
      google,
      factories,
    }) => {
      const user = await factories
        .get<UserEntity, UserFactoryMeta>(UserEntity)
        .setMeta({ email: WORKSPACE_EMAIL })
        .save();
      await factories
        .get<IdentityEntity, IdentityFactoryMeta>(IdentityEntity)
        .setMeta({ userId: user.id, subject: GOOGLE_SUBJECT })
        .save();

      const response = await google.signIn({ email: WORKSPACE_EMAIL });

      expect(response.status).toBe(200);
      expect((response.body as AuthSessionResponse).user.id).toBe(user.id);
    });

    test('signs in its user by subject and keeps the stored email', async ({
      google,
      factories,
      dataSource,
      recorder,
    }) => {
      const user = await factories
        .get<UserEntity, UserFactoryMeta>(UserEntity)
        .setMeta({ email: 'ann@example.test', withoutPassword: true })
        .save();
      await factories
        .get<IdentityEntity, IdentityFactoryMeta>(IdentityEntity)
        .setMeta({ userId: user.id, subject: GOOGLE_SUBJECT })
        .save();

      const response = await google.signIn({ email: 'someone.else@example.test' });

      expect(response.status).toBe(200);
      expect((response.body as AuthSessionResponse).user).toStrictEqual({
        id: user.id,
        email: 'ann@example.test',
      });
      expect((await storedUsers(dataSource)).map(({ id }) => id)).toEqual([user.id]);
      expect(recorder.all()).toEqual([]);
    });

    test('signs in even when the provider no longer marks the email verified', async ({
      google,
      factories,
    }) => {
      const user = await factories.get<UserEntity, UserFactoryMeta>(UserEntity).save();
      await factories
        .get<IdentityEntity, IdentityFactoryMeta>(IdentityEntity)
        .setMeta({ userId: user.id, subject: GOOGLE_SUBJECT })
        .save();

      const response = await google.signIn({ email_verified: false });

      expect(response.status).toBe(200);
      expect((response.body as AuthSessionResponse).user.id).toBe(user.id);
    });
  });

  describe('an existing account with the same email', () => {
    test('links a gmail.com identity to it and keeps the password working', async ({
      http,
      google,
      signIn,
      dataSource,
      recorder,
    }) => {
      const user = await signIn({ email: GOOGLE_EMAIL });

      const response = await google.signIn({ email: 'ANN.Reader@GMAIL.com' });
      const login = await http
        .post('/v1/auth/login')
        .send({ email: GOOGLE_EMAIL, password: FACTORY_USER_PASSWORD });

      expect(response.status).toBe(200);
      expect((response.body as AuthSessionResponse).user).toStrictEqual({
        id: user.id,
        email: GOOGLE_EMAIL,
      });
      expect(await storedIdentities(dataSource)).toStrictEqual([
        { provider: 'google', subject: GOOGLE_SUBJECT, userId: user.id },
      ]);
      expect(recorder.all()).toEqual([]);
      expect(login.status).toBe(200);
      expect((login.body as AuthSessionResponse).user.id).toBe(user.id);
    });

    test('links a Workspace identity whose hd matches the email domain', async ({
      google,
      signIn,
      dataSource,
    }) => {
      const user = await signIn({ email: WORKSPACE_EMAIL });

      const response = await google.signIn({ email: WORKSPACE_EMAIL, hd: 'Libro.Example.TEST' });

      expect(response.status).toBe(200);
      expect((response.body as AuthSessionResponse).user.id).toBe(user.id);
      expect(await storedIdentities(dataSource)).toStrictEqual([
        { provider: 'google', subject: GOOGLE_SUBJECT, userId: user.id },
      ]);
    });

    test.for([
      { case: 'an email outside gmail.com without hd', claims: { email: WORKSPACE_EMAIL } },
      {
        case: 'an hd that differs from the email domain',
        claims: { email: WORKSPACE_EMAIL, hd: 'other.example.test' },
      },
      { case: 'an empty hd', claims: { email: WORKSPACE_EMAIL, hd: '' } },
      { case: 'a non-string hd', claims: { email: WORKSPACE_EMAIL, hd: 42 } },
      {
        case: 'a gmail.com lookalike domain',
        claims: { email: 'ann@gmail.com.example.test', hd: undefined },
        email: 'ann@gmail.com.example.test',
      },
    ])(
      'answers 409 email_account_exists for $case and keeps the password account',
      async (
        { claims, email = WORKSPACE_EMAIL },
        { http, google, signIn, dataSource, recorder },
      ) => {
        const user = await signIn({ email });

        const response = await google.signIn(claims);
        const login = await http
          .post('/v1/auth/login')
          .send({ email, password: FACTORY_USER_PASSWORD });

        expect(response.status).toBe(409);
        expect(response.body).toStrictEqual({
          type: 'about:blank',
          title: 'Conflict',
          status: 409,
          detail: 'An account with this email already exists. Sign in with the password.',
          instance: GOOGLE_SIGN_IN_ROUTE,
          code: 'email_account_exists',
        });
        expect((await storedUsers(dataSource)).map(({ id }) => id)).toEqual([user.id]);
        expect(await storedIdentities(dataSource)).toEqual([]);
        expect(recorder.all()).toEqual([]);
        expect(login.status).toBe(200);
      },
    );

    test('answers 409 identity_conflict when it is linked to another Google account', async ({
      google,
      signIn,
      factories,
      dataSource,
    }) => {
      const user = await signIn({ email: GOOGLE_EMAIL });
      await factories
        .get<IdentityEntity, IdentityFactoryMeta>(IdentityEntity)
        .setMeta({ userId: user.id, subject: '100000000000000000001' })
        .save();

      const response = await google.signIn();

      expect(response.status).toBe(409);
      expect(response.body).toStrictEqual({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail:
          'The account with this email is already linked to another account of this provider.',
        instance: GOOGLE_SIGN_IN_ROUTE,
        code: 'identity_conflict',
      });
      expect(await storedIdentities(dataSource)).toStrictEqual([
        { provider: 'google', subject: '100000000000000000001', userId: user.id },
      ]);
    });
  });

  describe('the nonce', () => {
    test('is single use: the same ID token signs in only once', async ({ google }) => {
      const idToken = await google.token();

      const first = await google.post(idToken);
      const second = await google.post(idToken);

      expect(first.status).toBe(200);
      expect(second.status).toBe(401);
      expect(second.body).toStrictEqual(INVALID_IDENTITY_TOKEN);
    });

    test('lets exactly one of two concurrent sign-ins with the same ID token succeed', async ({
      google,
      dataSource,
      recorder,
    }) => {
      const idToken = await google.token();

      const responses = await Promise.all([google.post(idToken), google.post(idToken)]);

      expect(responses.map(({ status }) => status).toSorted()).toEqual([200, 401]);
      expect(await storedUsers(dataSource)).toHaveLength(1);
      expect(recorder.all()).toHaveLength(1);
    });

    test('answers 401 for a nonce that was never issued', async ({ google, dataSource }) => {
      const idToken = await googleIdToken(googleClaims('C'.repeat(43)));

      const response = await google.post(idToken);

      expect(response.status).toBe(401);
      expect(response.body).toStrictEqual(INVALID_IDENTITY_TOKEN);
      expect(await storedUsers(dataSource)).toEqual([]);
    });

    test('answers 401 for an expired nonce', async ({ google, dataSource }) => {
      const nonce = await google.nonce();
      await dataSource.query(
        `UPDATE auth.sign_in_nonces SET expires_at = clock_timestamp() - interval '1 second'`,
      );

      const response = await google.post(await googleIdToken(googleClaims(nonce)));

      expect(response.status).toBe(401);
      expect(response.body).toStrictEqual(INVALID_IDENTITY_TOKEN);
      expect(await storedUsers(dataSource)).toEqual([]);
    });
  });

  test('creates one user for concurrent first sign-ins of the same Google account', async ({
    google,
    dataSource,
    recorder,
  }) => {
    const idTokens = await Promise.all([google.token(), google.token(), google.token()]);

    const responses = await Promise.all(idTokens.map((idToken) => google.post(idToken)));
    const users = await storedUsers(dataSource);

    expect(responses.map(({ status }) => status)).toEqual([200, 200, 200]);
    expect(users).toHaveLength(1);
    expect(
      responses
        .map(({ body }) => (body as AuthSessionResponse).user.id)
        .every((id) => id === users[0]?.id),
    ).toBe(true);
    expect(await storedIdentities(dataSource)).toHaveLength(1);
    expect(recorder.all()).toHaveLength(1);
  });

  test('links only one of two concurrent first sign-ins of different Google accounts with the same email', async ({
    google,
    dataSource,
    recorder,
  }) => {
    const idTokens = await Promise.all([
      google.token({ sub: '100000000000000000001' }),
      google.token({ sub: '100000000000000000002' }),
    ]);

    const responses = await Promise.all(idTokens.map((idToken) => google.post(idToken)));
    const users = await storedUsers(dataSource);
    const conflict = responses.find(({ status }) => status === 409);

    expect(responses.map(({ status }) => status).toSorted()).toEqual([200, 409]);
    expect((conflict?.body as ProblemDetails | undefined)?.code).toBe('identity_conflict');
    expect(users).toHaveLength(1);
    expect(await storedIdentities(dataSource)).toStrictEqual([
      { provider: 'google', subject: expect.any(String) as string, userId: users[0]?.id },
    ]);
    expect(recorder.all()).toHaveLength(1);
  });

  test.for([
    { problem: 'a missing idToken', body: {}, code: 'invalid_type' },
    { problem: 'a non-string idToken', body: { idToken: 42 }, code: 'invalid_type' },
    {
      problem: 'two segments',
      body: { idToken: 'eyJhbGciOiJSUzI1NiJ9.e30' },
      code: 'invalid_format',
    },
    {
      problem: 'an empty signature',
      body: { idToken: 'eyJhbGciOiJub25lIn0.e30.' },
      code: 'invalid_format',
    },
    {
      problem: 'non-base64url characters',
      body: { idToken: 'a+b.c/d.e=f' },
      code: 'invalid_format',
    },
    {
      problem: 'more than 4096 characters',
      body: { idToken: `${'a'.repeat(2048)}.${'b'.repeat(2048)}.c` },
      code: 'too_big',
    },
  ])('rejects $problem with 400', async ({ body, code }, { http }) => {
    const response = await http.post(GOOGLE_SIGN_IN_ROUTE).send(body);
    const problem = response.body as ProblemDetails;

    expect(response.status).toBe(400);
    expect(problem.code).toBe('validation_failed');
    expect(problem.errors?.map((error) => ({ path: error.path, code: error.code }))).toEqual([
      { path: 'idToken', code },
    ]);
  });
});
