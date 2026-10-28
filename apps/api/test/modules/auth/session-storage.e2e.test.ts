import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import type { AuthSessionResponse } from '../../../src/modules/auth/http/auth-session.response.js';
import { test } from '../../support/integration-test.js';

async function sessionRows(dataSource: DataSource): Promise<string> {
  const rows = await dataSource.query<{ dump: string | null }[]>(
    `SELECT (SELECT json_agg(session)::text FROM auth.sessions session) ||
            (SELECT json_agg(token)::text FROM auth.refresh_tokens token) AS dump`,
  );

  return rows[0]?.dump ?? '';
}

async function countSessionRows(
  dataSource: DataSource,
): Promise<{ sessions: number; tokens: number }[]> {
  return dataSource.query(
    `SELECT (SELECT count(*)::int FROM auth.sessions) AS sessions,
            (SELECT count(*)::int FROM auth.refresh_tokens) AS tokens`,
  );
}

describe('session storage', () => {
  test('never stores a refresh token in plain text', async ({ http, signIn, dataSource }) => {
    const user = await signIn();
    const issued = [user.refreshToken];
    for (let rotation = 0; rotation < 2; rotation += 1) {
      const response = await http.post('/v1/auth/refresh').send({ refreshToken: issued.at(-1) });
      issued.push((response.body as AuthSessionResponse).refreshToken);
    }

    const stored = await sessionRows(dataSource);

    expect(stored).not.toBe('');
    for (const token of issued) {
      expect(stored).not.toContain(token);
    }
  });

  test('deletes the sessions and refresh tokens of a deleted user', async ({
    signIn,
    dataSource,
  }) => {
    const user = await signIn();
    const other = await signIn();

    await dataSource.query('DELETE FROM auth.users WHERE id = $1', [user.id]);

    expect(await countSessionRows(dataSource)).toEqual([{ sessions: 1, tokens: 1 }]);
    expect(await dataSource.query('SELECT user_id AS "userId" FROM auth.sessions')).toEqual([
      { userId: other.id },
    ]);
  });
});
