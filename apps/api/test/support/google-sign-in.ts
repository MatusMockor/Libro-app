import type { TestingModuleBuilder } from '@nestjs/testing';
import {
  base64url,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
} from 'jose';
import type { Agent, Response, Test } from 'supertest';
import { expect } from 'vitest';
import type { SignInNonceResponse } from '../../src/modules/auth/http/sign-in-nonce.response.js';
import { GOOGLE_SIGNING_KEYS } from '../../src/modules/identity-providers/providers/google.provider.js';
import { TEST_GOOGLE_IOS_CLIENT_ID } from './google-client-ids.js';

export const GOOGLE_SIGN_IN_ROUTE = '/v1/auth/google';
export const GOOGLE_NONCE_ROUTE = '/v1/auth/google/nonce';

export const GOOGLE_KEY_ID = 'test-google-key-1';
export const GOOGLE_SUBJECT = '110169484474386276334';
export const GOOGLE_EMAIL = 'ann.reader@gmail.test';

const SECONDS_PER_HOUR = 3_600;
const MILLISECONDS_PER_SECOND = 1_000;

const googleKeys = await generateKeyPair('RS256');
const foreignKeys = await generateKeyPair('RS256');

export const localGoogleSigningKeys = createLocalJWKSet({
  keys: [
    { ...(await exportJWK(googleKeys.publicKey)), kid: GOOGLE_KEY_ID, alg: 'RS256', use: 'sig' },
  ],
});

export type GoogleClaims = Record<string, unknown>;

export interface GoogleTokenOptions {
  readonly signingKey?: 'google' | 'foreign';
  readonly kid?: string;
}

export interface GoogleSignIn {
  nonce(): Promise<string>;
  post(idToken: string): Test;
  token(claims?: GoogleClaims, options?: GoogleTokenOptions): Promise<string>;
  signIn(claims?: GoogleClaims, options?: GoogleTokenOptions): Promise<Response>;
}

export function useLocalGoogleSigningKeys(builder: TestingModuleBuilder): TestingModuleBuilder {
  return builder.overrideProvider(GOOGLE_SIGNING_KEYS).useValue(localGoogleSigningKeys);
}

export function nowInSeconds(): number {
  return Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
}

export function googleClaims(nonce: string, overrides: GoogleClaims = {}): GoogleClaims {
  const now = nowInSeconds();

  return {
    iss: 'https://accounts.google.com',
    aud: TEST_GOOGLE_IOS_CLIENT_ID,
    azp: TEST_GOOGLE_IOS_CLIENT_ID,
    sub: GOOGLE_SUBJECT,
    email: GOOGLE_EMAIL,
    email_verified: true,
    nonce,
    iat: now,
    exp: now + SECONDS_PER_HOUR,
    ...overrides,
  };
}

export function googleIdToken(
  claims: GoogleClaims,
  { signingKey = 'google', kid = GOOGLE_KEY_ID }: GoogleTokenOptions = {},
): Promise<string> {
  const key: CryptoKey = signingKey === 'google' ? googleKeys.privateKey : foreignKeys.privateKey;

  return new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid, typ: 'JWT' }).sign(key);
}

export function hs256IdToken(claims: GoogleClaims): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256', kid: GOOGLE_KEY_ID, typ: 'JWT' })
    .sign(new TextEncoder().encode('a-symmetric-secret-of-at-least-32-bytes'));
}

export function unsecuredIdToken(claims: GoogleClaims, signature: string): string {
  const segment = (value: object) => base64url.encode(JSON.stringify(value));

  return `${segment({ alg: 'none', typ: 'JWT' })}.${segment(claims)}.${signature}`;
}

export function googleSignInWith(http: Agent): GoogleSignIn {
  const google: GoogleSignIn = {
    nonce: async () => {
      const response = await http.post(GOOGLE_NONCE_ROUTE);
      expect(response.status).toBe(201);

      return (response.body as SignInNonceResponse).nonce;
    },
    post: (idToken) => http.post(GOOGLE_SIGN_IN_ROUTE).send({ idToken }),
    token: async (claims = {}, options = {}) =>
      googleIdToken(googleClaims(await google.nonce(), claims), options),
    signIn: async (claims = {}, options = {}) => google.post(await google.token(claims, options)),
  };

  return google;
}
