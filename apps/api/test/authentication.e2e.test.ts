import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { describe, expect } from 'vitest';
import type { Env } from '../src/config/env.schema.js';
import type { AuthenticatedUser } from '../src/http/authentication/authenticated-user.js';
import { integrationTest } from './support/integration-test.js';
import { ProbeModule } from './support/probe/probe.module.js';

const ROUTE = '/v1/probe/protected';

const PROBLEM_JSON = /^application\/problem\+json(;|$)/;

interface Forge {
  forge: (claims: object, options?: JwtSignOptions) => string;
  signExactly: (claims: object) => string;
}

const nowInSeconds = (): number => Math.floor(Date.now() / 1000);

const test = integrationTest({ imports: [ProbeModule] })
  .extend('secret', { scope: 'file' }, ({ app }) =>
    app.get<ConfigService<Env, true>>(ConfigService).get('JWT_ACCESS_SECRET', { infer: true }),
  )
  .extend(
    'forge',
    { scope: 'file' },
    ({ secret }) =>
      (claims: object, options: JwtSignOptions = {}): string =>
        new JwtService().sign(claims, {
          secret,
          algorithm: 'HS256',
          issuer: 'libro-api',
          audience: 'libro-app',
          expiresIn: 900,
          ...options,
        }),
  )
  .extend(
    'signExactly',
    { scope: 'file' },
    ({ secret }) =>
      (claims: object): string =>
        new JwtService().sign(
          { iss: 'libro-api', aud: 'libro-app', ...claims },
          { secret, algorithm: 'HS256', noTimestamp: !('iat' in claims) },
        ),
  );

function unsignedToken(claims: object): string {
  const encode = (part: object): string => Buffer.from(JSON.stringify(part)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);

  return [
    encode({ alg: 'none', typ: 'JWT' }),
    encode({ iss: 'libro-api', aud: 'libro-app', iat: now, exp: now + 900, ...claims }),
    '',
  ].join('.');
}

const AUTHENTICATION_REQUIRED = {
  type: 'about:blank',
  title: 'Unauthorized',
  status: 401,
  detail: 'This endpoint needs an access token in the Authorization header (Bearer).',
  instance: ROUTE,
  code: 'authentication_required',
};

const INVALID_ACCESS_TOKEN = {
  type: 'about:blank',
  title: 'Unauthorized',
  status: 401,
  detail: 'The access token is invalid or expired.',
  instance: ROUTE,
  code: 'invalid_access_token',
};

describe('authentication guard', () => {
  test('lets a valid access token through and hands the user to @CurrentUser()', async ({
    http,
    signIn,
  }) => {
    const user = await signIn();

    const response = await http.get(ROUTE).set('Authorization', user.authorization);

    expect(response.status).toBe(200);
    expect(response.body as AuthenticatedUser).toStrictEqual({ id: user.id });
  });

  test('accepts the Bearer scheme in any case', async ({ http, signIn }) => {
    const user = await signIn();
    const token = user.authorization.replace(/^Bearer /, '');

    const response = await http.get(ROUTE).set('Authorization', `bEaReR ${token}`);

    expect(response.status).toBe(200);
  });

  test('accepts a token with the expected signature and claims', async ({ http, forge }) => {
    const userId = randomUUID();

    const response = await http.get(ROUTE).set('Authorization', `Bearer ${forge({ sub: userId })}`);

    expect(response.status).toBe(200);
    expect(response.body as AuthenticatedUser).toStrictEqual({ id: userId });
  });

  test('accepts a token that lives exactly 15 minutes', async ({ http, signExactly }) => {
    const iat = nowInSeconds();

    const response = await http
      .get(ROUTE)
      .set('Authorization', `Bearer ${signExactly({ sub: randomUUID(), iat, exp: iat + 900 })}`);

    expect(response.status).toBe(200);
  });

  test('answers 401 authentication_required without an Authorization header', async ({ http }) => {
    const response = await http.get(ROUTE);

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toMatch(PROBLEM_JSON);
    expect(response.headers['www-authenticate']).toBe('Bearer');
    expect(response.body).toStrictEqual(AUTHENTICATION_REQUIRED);
  });

  test.for([
    { name: 'another scheme', header: 'Basic cmVhZGVyOnNlY3JldA==' },
    { name: 'the scheme without a token', header: 'Bearer' },
    { name: 'the scheme with an empty token', header: 'Bearer ' },
    { name: 'a token with spaces', header: 'Bearer abc def' },
    { name: 'a token without the scheme', header: 'eyJhbGciOiJIUzI1NiJ9.e30.c2ln' },
  ])('answers 401 authentication_required for $name', async ({ header }, { http }) => {
    const response = await http.get(ROUTE).set('Authorization', header);

    expect(response.status).toBe(401);
    expect(response.headers['www-authenticate']).toBe('Bearer');
    expect(response.body).toStrictEqual(AUTHENTICATION_REQUIRED);
  });

  test.for([
    {
      name: 'an expired token',
      token: ({ forge }: Forge) => forge({ sub: randomUUID() }, { expiresIn: -1 }),
    },
    {
      name: 'a token that is not valid yet',
      token: ({ forge }: Forge) => forge({ sub: randomUUID() }, { notBefore: 60 }),
    },
    {
      name: 'a token signed with another secret',
      token: ({ forge }: Forge) =>
        forge({ sub: randomUUID() }, { secret: 'another-secret-that-is-long-enough-too' }),
    },
    {
      name: 'a token signed with another HMAC algorithm',
      token: ({ forge }: Forge) => forge({ sub: randomUUID() }, { algorithm: 'HS512' }),
    },
    {
      name: 'an unsigned token (alg none)',
      token: () => unsignedToken({ sub: randomUUID() }),
    },
    {
      name: 'a token from another issuer',
      token: ({ forge }: Forge) => forge({ sub: randomUUID() }, { issuer: 'another-api' }),
    },
    {
      name: 'a token for another audience',
      token: ({ forge }: Forge) => forge({ sub: randomUUID() }, { audience: 'another-app' }),
    },
    {
      name: 'a token without a subject',
      token: ({ forge }: Forge) => forge({}),
    },
    {
      name: 'a token whose subject is not a user id',
      token: ({ forge }: Forge) => forge({ sub: 'admin' }),
    },
    {
      name: 'a token with a tampered payload',
      token: ({ forge }: Forge) => {
        const [header, , signature] = forge({ sub: randomUUID() }).split('.');
        const payload = Buffer.from(
          JSON.stringify({ sub: randomUUID(), iss: 'libro-api', aud: 'libro-app' }),
        ).toString('base64url');

        return [header, payload, signature].join('.');
      },
    },
    { name: 'a value that is not a JWT', token: () => 'not-a-jwt' },
    {
      name: 'a token without an expiry',
      token: ({ signExactly }: Forge) => signExactly({ sub: randomUUID(), iat: nowInSeconds() }),
    },
    {
      name: 'a token without an issued-at time',
      token: ({ signExactly }: Forge) =>
        signExactly({ sub: randomUUID(), exp: nowInSeconds() + 900 }),
    },
    {
      name: 'a token without an expiry and an issued-at time',
      token: ({ signExactly }: Forge) => signExactly({ sub: randomUUID() }),
    },
    {
      name: 'a token that lives longer than 15 minutes',
      token: ({ signExactly }: Forge) => {
        const iat = nowInSeconds();

        return signExactly({ sub: randomUUID(), iat, exp: iat + 901 });
      },
    },
    {
      name: 'a token issued in the future',
      token: ({ signExactly }: Forge) => {
        const iat = nowInSeconds() + 60;

        return signExactly({ sub: randomUUID(), iat, exp: iat + 900 });
      },
    },
    {
      name: 'a token with a fractional issued-at time',
      token: ({ signExactly }: Forge) => {
        const iat = nowInSeconds() - 0.5;

        return signExactly({ sub: randomUUID(), iat, exp: iat + 900 });
      },
    },
  ])(
    'answers 401 invalid_access_token for $name',
    async ({ token }, { http, forge, signExactly }) => {
      const response = await http
        .get(ROUTE)
        .set('Authorization', `Bearer ${token({ forge, signExactly })}`);

      expect(response.status).toBe(401);
      expect(response.headers['content-type']).toMatch(PROBLEM_JSON);
      expect(response.headers['www-authenticate']).toBe('Bearer error="invalid_token"');
      expect(response.body).toStrictEqual(INVALID_ACCESS_TOKEN);
    },
  );

  test.for(['/health', '/v1/probe/books?limit=1'])(
    'keeps the public route %s open without a token',
    async (route, { http }) => {
      const response = await http.get(route);

      expect(response.status).toBe(200);
    },
  );

  test('ignores an invalid token on a public route', async ({ http }) => {
    const response = await http.get('/health').set('Authorization', 'Bearer not-a-jwt');

    expect(response.status).toBe(200);
  });

  test('keeps unknown routes a 404 without a token', async ({ http }) => {
    const response = await http.get('/v1/no-such-route');

    expect(response.status).toBe(404);
  });
});
