import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import {
  FACTORY_USER_PASSWORD,
  type UserFactoryMeta,
} from '../../../src/modules/auth/factories/user.factory.js';
import type { IdentityFactoryMeta } from '../../../src/modules/auth/factories/identity.factory.js';
import type { AuthSessionResponse } from '../../../src/modules/auth/http/auth-session.response.js';
import { IdentityEntity } from '../../../src/modules/auth/persistence/identity.entity.js';
import { UserEntity } from '../../../src/modules/auth/persistence/user.entity.js';
import { GOOGLE_SUBJECT } from '../../support/google-sign-in.js';
import {
  DELETION_ROUTE,
  filesOf,
  follows,
  needlesOf,
  storedFiles,
  tablesMentioning,
  test,
  tombstones,
} from './account-deletion.fixture.js';

const OTHER_GOOGLE_SUBJECT = '220000000000000000001';

const INVALID_CREDENTIALS = {
  type: 'about:blank',
  title: 'Unauthorized',
  status: 401,
  detail: 'The email or password is incorrect.',
  instance: DELETION_ROUTE,
  code: 'invalid_credentials',
};

const IDENTITY_NOT_LINKED = {
  type: 'about:blank',
  title: 'Unauthorized',
  status: 401,
  detail: 'The identity token does not belong to a provider account linked to this account.',
  instance: DELETION_ROUTE,
  code: 'identity_not_linked',
};

const INVALID_ACCESS_TOKEN = 'invalid_access_token';

function codeOf(body: unknown): string | undefined {
  return (body as ProblemDetails).code;
}

describe('POST /v1/me/deletion', () => {
  describe('confirmed with the password', () => {
    test('answers 204, deletes the account and its data and leaves only a tombstone', async ({
      http,
      dataSource,
      mediaRoot,
      recorder,
      arrangeAccount,
      deleteAccount,
    }) => {
      const ann = await arrangeAccount();
      const ben = await arrangeAccount();
      const cleo = await arrangeAccount();
      await follows(http, ann, ben, cleo);
      await follows(http, ben, ann, cleo);
      await follows(http, cleo, ann);
      const filesBefore = await storedFiles(mediaRoot);

      const response = await deleteAccount(ann, { password: FACTORY_USER_PASSWORD });

      expect(response.status).toBe(204);
      expect(response.text).toBe('');
      expect(await tombstones(dataSource)).toEqual([{ userId: ann.id }]);
      expect(await tablesMentioning(dataSource, needlesOf(ann))).toEqual([]);
      expect(filesOf(await storedFiles(mediaRoot), ann.mediaIds)).toEqual([]);
      expect(filesOf(await storedFiles(mediaRoot), [...ben.mediaIds, ...cleo.mediaIds])).toEqual(
        filesOf(filesBefore, [...ben.mediaIds, ...cleo.mediaIds]),
      );
      expect(
        recorder
          .all()
          .map(({ handler, event }) => ({ handler, name: event.name, payload: event.payload })),
      ).toEqual([{ handler: 'auth.deleted.v1', name: 'UserDeleted', payload: { userId: ann.id } }]);
    });

    test('leaves the data of other users untouched, including their other follows', async ({
      http,
      dataSource,
      arrangeAccount,
      deleteAccount,
    }) => {
      const ann = await arrangeAccount();
      const ben = await arrangeAccount();
      const cleo = await arrangeAccount();
      await follows(http, ann, ben);
      await follows(http, ben, ann, cleo);
      const benTablesBefore = await tablesMentioning(dataSource, needlesOf(ben));

      await deleteAccount(ann, { password: FACTORY_USER_PASSWORD });
      const benProfile = await http
        .get(`/v1/profiles/${ben.id}`)
        .set('Authorization', cleo.authorization);
      const benFollowing = await http
        .get(`/v1/profiles/${ben.id}/following`)
        .set('Authorization', cleo.authorization);

      expect(await tablesMentioning(dataSource, needlesOf(ben))).toEqual(benTablesBefore);
      expect(benProfile.status).toBe(200);
      expect(benProfile.body).toMatchObject({ followerCount: 0, followingCount: 1 });
      expect((benFollowing.body as { items: { userId: string }[] }).items).toEqual([
        expect.objectContaining({ userId: cleo.id }),
      ]);
    });

    test('answers 401 invalid_credentials for a wrong password and deletes nothing', async ({
      dataSource,
      recorder,
      arrangeAccount,
      deleteAccount,
    }) => {
      const ann = await arrangeAccount();
      const tablesBefore = await tablesMentioning(dataSource, needlesOf(ann));

      const response = await deleteAccount(ann, { password: 'not the password' });

      expect(response.status).toBe(401);
      expect(response.body).toStrictEqual(INVALID_CREDENTIALS);
      expect(await tablesMentioning(dataSource, needlesOf(ann))).toEqual(tablesBefore);
      expect(await tombstones(dataSource)).toEqual([]);
      expect(recorder.all()).toEqual([]);
    });

    test('answers 401 invalid_credentials for an account without a password', async ({
      dataSource,
      signIn,
      deleteAccount,
    }) => {
      const ann = await signIn({ withoutPassword: true });

      const response = await deleteAccount(ann, { password: FACTORY_USER_PASSWORD });

      expect(response.status).toBe(401);
      expect(response.body).toStrictEqual(INVALID_CREDENTIALS);
      expect(await tombstones(dataSource)).toEqual([]);
    });

    test('lets the same email register again as a new account', async ({
      http,
      dataSource,
      deleteAccount,
    }) => {
      const credentials = { email: 'ann.reader@example.test', password: FACTORY_USER_PASSWORD };
      const first = (await http.post('/v1/auth/register').send(credentials))
        .body as AuthSessionResponse;

      await deleteAccount(
        { authorization: `Bearer ${first.accessToken}` },
        { password: FACTORY_USER_PASSWORD },
      );
      const again = await http.post('/v1/auth/register').send(credentials);
      const login = await http.post('/v1/auth/login').send(credentials);

      expect(again.status).toBe(201);
      expect((again.body as AuthSessionResponse).user.id).not.toBe(first.user.id);
      expect(login.status).toBe(200);
      expect(await tombstones(dataSource)).toEqual([{ userId: first.user.id }]);
    });
  });

  describe('after the deletion', () => {
    test('refuses an access token issued before it and recreates nothing', async ({
      http,
      dataSource,
      mediaRoot,
      signIn,
      arrangeAccount,
      deleteAccount,
    }) => {
      const ann = await arrangeAccount();
      const ben = await arrangeAccount(await signIn());
      await deleteAccount(ann, { password: FACTORY_USER_PASSWORD });

      const responses = [
        await http.get('/v1/me').set('Authorization', ann.authorization),
        await http.get('/v1/me/profile').set('Authorization', ann.authorization),
        await http
          .patch('/v1/me/profile')
          .set('Authorization', ann.authorization)
          .send({ displayName: 'Back again' }),
        await http.put(`/v1/profiles/${ben.id}/follow`).set('Authorization', ann.authorization),
        await http
          .post('/v1/reading-sessions')
          .set('Authorization', ann.authorization)
          .send({ workId: ann.readingIds[0] }),
        await http
          .post('/v1/media')
          .set('Authorization', ann.authorization)
          .attach('file', Buffer.from('not read'), {
            filename: 'photo.jpg',
            contentType: 'image/jpeg',
          }),
        await deleteAccount(ann, { password: FACTORY_USER_PASSWORD }),
      ];

      expect(responses.map(({ status, body }) => ({ status, code: codeOf(body) }))).toEqual(
        Array.from({ length: responses.length }, () => ({
          status: 401,
          code: INVALID_ACCESS_TOKEN,
        })),
      );
      expect(await tablesMentioning(dataSource, needlesOf(ann))).toEqual([]);
      expect(filesOf(await storedFiles(mediaRoot), ann.mediaIds)).toEqual([]);
    });

    test('refuses the refresh token of the account', async ({ http, signIn, deleteAccount }) => {
      const ann = await signIn();
      await deleteAccount(ann, { password: FACTORY_USER_PASSWORD });

      const response = await http.post('/v1/auth/refresh').send({ refreshToken: ann.refreshToken });

      expect(response.status).toBe(401);
      expect(codeOf(response.body)).toBe('invalid_refresh_token');
    });

    test('refuses a login with the old credentials', async ({ http, signIn, deleteAccount }) => {
      const ann = await signIn();
      await deleteAccount(ann, { password: FACTORY_USER_PASSWORD });

      const response = await http
        .post('/v1/auth/login')
        .send({ email: ann.email, password: FACTORY_USER_PASSWORD });

      expect(response.status).toBe(401);
      expect(codeOf(response.body)).toBe('invalid_credentials');
    });
  });

  describe('confirmed with a Google sign-in', () => {
    test('answers 204 for an account without a password and a fresh Google token', async ({
      dataSource,
      google,
      recorder,
      deleteAccount,
    }) => {
      const signedIn = (await google.signIn()).body as AuthSessionResponse;
      const ann = { id: signedIn.user.id, authorization: `Bearer ${signedIn.accessToken}` };
      recorder.clear();

      const response = await deleteAccount(ann, {
        provider: 'google',
        idToken: await google.token(),
      });

      expect(response.status).toBe(204);
      expect(await tombstones(dataSource)).toEqual([{ userId: ann.id }]);
      expect(
        await tablesMentioning(dataSource, [ann.id, signedIn.user.email, GOOGLE_SUBJECT]),
      ).toEqual([]);
      expect(recorder.all().map(({ event }) => event.payload)).toEqual([{ userId: ann.id }]);
    });

    test.for([
      { confirmation: 'the password', google: false },
      { confirmation: 'a Google token', google: true },
    ])(
      'answers 204 for an account with a password and Google confirmed with $confirmation',
      async ({ google: withGoogle }, { dataSource, factories, google, signIn, deleteAccount }) => {
        const ann = await signIn();
        await factories
          .get<IdentityEntity, IdentityFactoryMeta>(IdentityEntity)
          .setMeta({ userId: ann.id, subject: GOOGLE_SUBJECT })
          .save();
        const body = withGoogle
          ? { provider: 'google', idToken: await google.token() }
          : { password: FACTORY_USER_PASSWORD };

        const response = await deleteAccount(ann, body);

        expect(response.status).toBe(204);
        expect(await tombstones(dataSource)).toEqual([{ userId: ann.id }]);
      },
    );

    test.for([
      { case: 'a Google account linked to another user', linkedToOther: true },
      { case: 'a Google account linked to nobody', linkedToOther: false },
    ])(
      'answers 401 identity_not_linked for $case and deletes nothing',
      async ({ linkedToOther }, { dataSource, factories, google, signIn, deleteAccount }) => {
        const ann = await signIn({ withoutPassword: true });
        await factories
          .get<IdentityEntity, IdentityFactoryMeta>(IdentityEntity)
          .setMeta({ userId: ann.id, subject: GOOGLE_SUBJECT })
          .save();
        if (linkedToOther) {
          const ben = await factories.get<UserEntity, UserFactoryMeta>(UserEntity).save();
          await factories
            .get<IdentityEntity, IdentityFactoryMeta>(IdentityEntity)
            .setMeta({ userId: ben.id, subject: OTHER_GOOGLE_SUBJECT })
            .save();
        }

        const response = await deleteAccount(ann, {
          provider: 'google',
          idToken: await google.token({ sub: OTHER_GOOGLE_SUBJECT, email: 'ben@gmail.com' }),
        });

        expect(response.status).toBe(401);
        expect(response.body).toStrictEqual(IDENTITY_NOT_LINKED);
        expect(await tombstones(dataSource)).toEqual([]);
        expect(await tablesMentioning(dataSource, [ann.id])).toEqual([
          'auth.identities',
          'auth.sessions',
          'auth.users',
        ]);
      },
    );

    test('answers 401 invalid_identity_token for a token whose nonce was already used', async ({
      dataSource,
      google,
      deleteAccount,
    }) => {
      const idToken = await google.token();
      const signedIn = (await google.post(idToken)).body as AuthSessionResponse;

      const response = await deleteAccount(
        { authorization: `Bearer ${signedIn.accessToken}` },
        { provider: 'google', idToken },
      );

      expect(response.status).toBe(401);
      expect(codeOf(response.body)).toBe('invalid_identity_token');
      expect(await tombstones(dataSource)).toEqual([]);
    });

    test('answers 401 invalid_identity_token for a token with a foreign signature', async ({
      dataSource,
      google,
      deleteAccount,
    }) => {
      const signedIn = (await google.signIn()).body as AuthSessionResponse;

      const response = await deleteAccount(
        { authorization: `Bearer ${signedIn.accessToken}` },
        { provider: 'google', idToken: await google.token({}, { signingKey: 'foreign' }) },
      );

      expect(response.status).toBe(401);
      expect(codeOf(response.body)).toBe('invalid_identity_token');
      expect(await tombstones(dataSource)).toEqual([]);
    });
  });

  describe('input', () => {
    test.for([
      { case: 'an empty body', body: {} },
      { case: 'an empty password', body: { password: '' } },
      { case: 'a password that is not a string', body: { password: 1234567890 } },
      { case: 'a provider without an ID token', body: { provider: 'google' } },
      { case: 'an ID token without a provider', body: { idToken: 'a.b.c' } },
      { case: 'an unknown provider', body: { provider: 'apple', idToken: 'a.b.c' } },
      { case: 'an ID token that is not a JWS', body: { provider: 'google', idToken: 'token' } },
      {
        case: 'both a password and an ID token',
        body: { password: FACTORY_USER_PASSWORD, provider: 'google', idToken: 'a.b.c' },
      },
    ])(
      'answers 400 validation_failed for $case',
      async ({ body }, { signIn, dataSource, deleteAccount }) => {
        const ann = await signIn();

        const response = await deleteAccount(ann, body);

        expect(response.status).toBe(400);
        expect(codeOf(response.body)).toBe('validation_failed');
        expect(JSON.stringify(response.body)).not.toContain(FACTORY_USER_PASSWORD);
        expect(await tombstones(dataSource)).toEqual([]);
      },
    );

    test('answers 401 authentication_required without an access token', async ({ http }) => {
      const response = await http.post(DELETION_ROUTE).send({ password: FACTORY_USER_PASSWORD });

      expect(response.status).toBe(401);
      expect(codeOf(response.body)).toBe('authentication_required');
    });
  });
});
