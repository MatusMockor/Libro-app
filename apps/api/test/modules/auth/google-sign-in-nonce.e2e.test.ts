import { createHash } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import type { SignInNonceResponse } from '../../../src/modules/auth/http/sign-in-nonce.response.js';
import { GOOGLE_NONCE_ROUTE } from '../../support/google-sign-in.js';
import { googleSignInTest as test } from './google-sign-in.fixture.js';

const NONCE_LIFETIME_SECONDS = 600;
const EXPIRED_NONCES_REMOVED_PER_ISSUE = 100;

interface StoredNonce {
  nonceHash: string;
  provider: string;
  lifetimeSeconds: number;
  dump: string;
}

function storedNonces(dataSource: DataSource): Promise<StoredNonce[]> {
  return dataSource.query<StoredNonce[]>(
    `SELECT nonce_hash AS "nonceHash", provider,
            round(extract(epoch FROM expires_at - created_at))::int AS "lifetimeSeconds",
            row_to_json(nonce)::text AS dump
     FROM auth.sign_in_nonces AS nonce`,
  );
}

async function arrangeExpiredNonces(dataSource: DataSource, count: number): Promise<void> {
  await dataSource.query(
    `INSERT INTO auth.sign_in_nonces (nonce_hash, provider, expires_at)
     SELECT encode(sha256(convert_to('expired-' || serial, 'UTF8')), 'hex'), 'google',
            clock_timestamp() - make_interval(secs => serial)
     FROM generate_series(1, $1::int) AS serial`,
    [count],
  );
}

describe('POST /v1/auth/google/nonce', () => {
  test('answers 201 with a single-use nonce valid for 10 minutes', async ({ http }) => {
    const response = await http.post(GOOGLE_NONCE_ROUTE);

    expect(response.status).toBe(201);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toStrictEqual({
      nonce: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) as string,
      expiresIn: NONCE_LIFETIME_SECONDS,
    });
  });

  test('stores only the SHA-256 hash of the nonce with a lifetime from the database clock', async ({
    http,
    dataSource,
  }) => {
    const { nonce } = (await http.post(GOOGLE_NONCE_ROUTE)).body as SignInNonceResponse;

    const [stored, ...others] = await storedNonces(dataSource);

    expect(others).toEqual([]);
    expect(stored?.nonceHash).toBe(createHash('sha256').update(nonce).digest('hex'));
    expect(stored?.provider).toBe('google');
    expect(stored?.lifetimeSeconds).toBe(NONCE_LIFETIME_SECONDS);
    expect(stored?.dump).not.toContain(nonce);
  });

  test('issues a different nonce every time', async ({ google }) => {
    const nonces = await Promise.all([google.nonce(), google.nonce(), google.nonce()]);

    expect(new Set(nonces).size).toBe(3);
  });

  test('removes a bounded batch of expired nonces when issuing a new one', async ({
    http,
    dataSource,
  }) => {
    await arrangeExpiredNonces(dataSource, EXPIRED_NONCES_REMOVED_PER_ISSUE + 5);

    await http.post(GOOGLE_NONCE_ROUTE);
    const afterFirst = await storedNonces(dataSource);
    await http.post(GOOGLE_NONCE_ROUTE);
    const afterSecond = await storedNonces(dataSource);

    expect(afterFirst).toHaveLength(5 + 1);
    expect(afterSecond).toHaveLength(2);
    expect(afterSecond.every(({ lifetimeSeconds }) => lifetimeSeconds === 600)).toBe(true);
  });

  test('is public', async ({ http }) => {
    const response = await http.post(GOOGLE_NONCE_ROUTE).set('Authorization', 'Bearer not-a-jwt');

    expect(response.status).toBe(201);
  });
});
