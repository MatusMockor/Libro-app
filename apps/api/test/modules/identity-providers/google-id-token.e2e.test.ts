import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import {
  TEST_GOOGLE_ANDROID_CLIENT_ID,
  TEST_GOOGLE_IOS_CLIENT_ID,
  TEST_GOOGLE_WEB_CLIENT_ID,
} from '../../support/google-client-ids.js';
import {
  GOOGLE_SIGN_IN_ROUTE,
  googleClaims,
  googleIdToken,
  hs256IdToken,
  nowInSeconds,
  unsecuredIdToken,
  type GoogleClaims,
  type GoogleTokenOptions,
} from '../../support/google-sign-in.js';
import { googleSignInTest as test } from '../auth/google-sign-in.fixture.js';

const INVALID_IDENTITY_TOKEN = {
  type: 'about:blank',
  title: 'Unauthorized',
  status: 401,
  detail: 'The identity token is invalid, expired or already used. Sign in again.',
  instance: GOOGLE_SIGN_IN_ROUTE,
  code: 'invalid_identity_token',
};

const FOREIGN_CLIENT_ID = 'someone-else.apps.googleusercontent.test';
const BEYOND_CLOCK_TOLERANCE_SECONDS = 120;

type TokenFor = (nonce: string) => Promise<string> | string;

function signed(overrides: GoogleClaims, options: GoogleTokenOptions = {}): TokenFor {
  return (nonce) => googleIdToken(googleClaims(nonce, overrides), options);
}

async function storedCounts(dataSource: DataSource): Promise<{ users: number; nonces: number }> {
  const [counts] = await dataSource.query<{ users: number; nonces: number }[]>(
    `SELECT (SELECT count(*) FROM auth.users)::int AS users,
            (SELECT count(*) FROM auth.sign_in_nonces)::int AS nonces`,
  );

  return counts ?? { users: -1, nonces: -1 };
}

describe('Google ID token validation', () => {
  test.for([
    { case: 'the issuer without scheme', tokenFor: signed({ iss: 'accounts.google.com' }) },
    {
      case: 'an Android token for the web client',
      tokenFor: signed({ aud: TEST_GOOGLE_WEB_CLIENT_ID, azp: TEST_GOOGLE_ANDROID_CLIENT_ID }),
    },
    { case: 'a token without azp', tokenFor: signed({ azp: undefined }) },
    {
      case: 'several audiences that are all ours, with azp',
      tokenFor: signed({
        aud: [TEST_GOOGLE_IOS_CLIENT_ID, TEST_GOOGLE_WEB_CLIENT_ID],
        azp: TEST_GOOGLE_IOS_CLIENT_ID,
      }),
    },
    {
      case: 'an expiry within the clock tolerance',
      tokenFor: signed({ exp: nowInSeconds() - 30 }),
    },
  ])('accepts $case', async ({ tokenFor }, { google }) => {
    const response = await google.post(await tokenFor(await google.nonce()));

    expect(response.status).toBe(200);
  });

  test.for([
    { case: 'a foreign issuer', tokenFor: signed({ iss: 'https://accounts.example.test' }) },
    { case: 'a missing issuer', tokenFor: signed({ iss: undefined }) },
    {
      case: 'an audience that is not ours',
      tokenFor: signed({ aud: FOREIGN_CLIENT_ID, azp: undefined }),
    },
    { case: 'a missing audience', tokenFor: signed({ aud: undefined }) },
    {
      case: 'an extra audience that is not ours',
      tokenFor: signed({
        aud: [TEST_GOOGLE_IOS_CLIENT_ID, FOREIGN_CLIENT_ID],
        azp: TEST_GOOGLE_IOS_CLIENT_ID,
      }),
    },
    { case: 'an azp that is not ours', tokenFor: signed({ azp: FOREIGN_CLIENT_ID }) },
    {
      case: 'several audiences without azp',
      tokenFor: signed({
        aud: [TEST_GOOGLE_IOS_CLIENT_ID, TEST_GOOGLE_WEB_CLIENT_ID],
        azp: undefined,
      }),
    },
    {
      case: 'an expired token',
      tokenFor: signed({ exp: nowInSeconds() - BEYOND_CLOCK_TOLERANCE_SECONDS }),
    },
    { case: 'a missing expiry', tokenFor: signed({ exp: undefined }) },
    {
      case: 'an issued-at in the future',
      tokenFor: signed({ iat: nowInSeconds() + BEYOND_CLOCK_TOLERANCE_SECONDS }),
    },
    { case: 'a missing issued-at', tokenFor: signed({ iat: undefined }) },
    {
      case: 'a not-before in the future',
      tokenFor: signed({ nbf: nowInSeconds() + BEYOND_CLOCK_TOLERANCE_SECONDS }),
    },
    { case: 'a missing subject', tokenFor: signed({ sub: undefined }) },
    { case: 'an empty subject', tokenFor: signed({ sub: '' }) },
    { case: 'a numeric subject', tokenFor: signed({ sub: 1234 }) },
    { case: 'a missing nonce', tokenFor: signed({ nonce: undefined }) },
    { case: 'an empty nonce', tokenFor: signed({ nonce: '' }) },
    {
      case: 'a token signed with HS256',
      tokenFor: (nonce: string) => hs256IdToken(googleClaims(nonce)),
    },
    {
      case: 'an unsecured token (alg none)',
      tokenFor: (nonce: string) => unsecuredIdToken(googleClaims(nonce), 'c2lnbmF0dXJl'),
    },
    {
      case: 'a token signed by another key under the Google key id',
      tokenFor: signed({}, { signingKey: 'foreign' }),
    },
    {
      case: 'a token with an unknown key id',
      tokenFor: signed({}, { signingKey: 'foreign', kid: 'unknown-key-id' }),
    },
  ])(
    'answers 401 invalid_identity_token for $case and keeps the nonce',
    async ({ tokenFor }, { google, dataSource }) => {
      const nonce = await google.nonce();

      const rejected = await google.post(await tokenFor(nonce));
      const counts = await storedCounts(dataSource);
      const valid = await google.post(await googleIdToken(googleClaims(nonce)));

      expect(rejected.status).toBe(401);
      expect(rejected.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(rejected.body).toStrictEqual(INVALID_IDENTITY_TOKEN);
      expect(counts).toStrictEqual({ users: 0, nonces: 1 });
      expect(valid.status).toBe(200);
    },
  );
});
