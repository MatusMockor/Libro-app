import { errors, type JWTVerifyGetKey } from 'jose';
import { describe, expect, onTestFinished } from 'vitest';
import { GOOGLE_SIGNING_KEYS } from '../../../src/modules/identity-providers/providers/google.provider.js';
import {
  GOOGLE_SIGN_IN_ROUTE,
  googleClaims,
  googleIdToken,
  googleSignInWith,
  localGoogleSigningKeys,
} from '../../support/google-sign-in.js';
import { integrationTest } from '../../support/integration-test.js';

let keySourceFailure: Error | undefined;

const flakySigningKeys: JWTVerifyGetKey = (protectedHeader, token) => {
  if (keySourceFailure) {
    return Promise.reject(keySourceFailure);
  }

  return localGoogleSigningKeys(protectedHeader, token);
};

const test = integrationTest({
  configure: (builder) => builder.overrideProvider(GOOGLE_SIGNING_KEYS).useValue(flakySigningKeys),
})
  .extend('google', ({ http }) => googleSignInWith(http))
  .extend('failingKeySource', () => (failure: Error) => {
    keySourceFailure = failure;
    onTestFinished(() => {
      keySourceFailure = undefined;
    });
  });

describe('Google signing key source', () => {
  test.for([
    { case: 'a timeout', failure: new errors.JWKSTimeout() },
    { case: 'an invalid key set', failure: new errors.JWKSInvalid('JSON Web Key Set malformed') },
    { case: 'an invalid key', failure: new errors.JWKInvalid('Invalid JWK') },
    {
      case: 'an error response',
      failure: new errors.JOSEError('Expected 200 OK from the JSON Web Key Set HTTP response'),
    },
    {
      case: 'a response that is not JSON',
      failure: new errors.JOSEError('Failed to parse the JSON Web Key Set HTTP response as JSON'),
    },
    { case: 'an unreachable host', failure: new TypeError('fetch failed') },
  ])(
    'answers 503 identity_provider_unavailable for $case and keeps the nonce',
    async ({ failure }, { google, failingKeySource }) => {
      const nonce = await google.nonce();
      const idToken = await googleIdToken(googleClaims(nonce));
      failingKeySource(failure);

      const unavailable = await google.post(idToken);
      keySourceFailure = undefined;
      const retried = await google.post(idToken);

      expect(unavailable.status).toBe(503);
      expect(unavailable.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(unavailable.body).toStrictEqual({
        type: 'about:blank',
        title: 'Service Unavailable',
        status: 503,
        detail: 'Service Unavailable',
        instance: GOOGLE_SIGN_IN_ROUTE,
        code: 'identity_provider_unavailable',
      });
      expect(retried.status).toBe(200);
    },
  );

  test('answers 401 invalid_identity_token when no key matches the token', async ({
    google,
    failingKeySource,
  }) => {
    const idToken = await google.token();
    failingKeySource(new errors.JWKSNoMatchingKey());

    const response = await google.post(idToken);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'invalid_identity_token' });
  });
});
