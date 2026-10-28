import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import {
  MAX_CHECKPOINTS_PER_SESSION,
  MAX_MARKED_PARTS_PER_SESSION,
} from '../../../src/modules/reading-sessions/domain/reading-session.js';
import { lockSession, requestsWaitingForSessionLock } from '../../support/session-lock.js';
import { SESSIONS_ROUTE, test } from './reading-sessions.fixture.js';

const READING_SESSIONS_QUERY = '%reading.sessions%';

interface Limited {
  readonly name: string;
  readonly path: string;
  readonly body: object;
  readonly table: string;
  readonly limit: number;
  readonly arrange: string;
}

const LIMITED: readonly Limited[] = [
  {
    name: 'checkpoints',
    path: 'checkpoints',
    body: { page: 5 },
    table: 'checkpoints',
    limit: MAX_CHECKPOINTS_PER_SESSION,
    arrange: `INSERT INTO reading.checkpoints (session_id, page)
              SELECT $1, page FROM generate_series(1, $2) AS page`,
  },
  {
    name: 'marked parts',
    path: 'marked-parts',
    body: { kind: 'good', fromPage: 1, toPage: 5 },
    table: 'marked_parts',
    limit: MAX_MARKED_PARTS_PER_SESSION,
    arrange: `INSERT INTO reading.marked_parts (session_id, kind, from_page, to_page)
              SELECT $1, 'slow', page, page FROM generate_series(1, $2) AS page`,
  },
];

async function storedFor(dataSource: DataSource, table: string): Promise<number | undefined> {
  const [row] = await dataSource.query<{ stored: number }[]>(
    `SELECT count(*)::int AS stored FROM reading.${table}`,
  );

  return row?.stored;
}

describe.for(LIMITED)('the limit of $limit $name per reading session', (limited) => {
  const { path, body, table, limit, arrange } = limited;

  test('accepts the last one and answers 409 reading_session_limit_reached after it', async ({
    reader,
    dataSource,
  }) => {
    const session = await reader.startedSession();
    const route = `${SESSIONS_ROUTE}/${session.id}/${path}`;
    await dataSource.query(arrange, [session.id, limit - 1]);

    const last = await reader.post(route, body);
    const over = await reader.post(route, body);

    expect(last.status).toBe(201);
    expect(over.status).toBe(409);
    expect(over.body).toStrictEqual({
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: `A reading session can hold at most ${String(limit)} ${limited.name}.`,
      instance: route,
      code: 'reading_session_limit_reached',
    });
    expect(await storedFor(dataSource, table)).toBe(limit);
  });

  test('lets only one of two concurrent requests take the last place', async ({
    reader,
    dataSource,
  }) => {
    const session = await reader.startedSession();
    const route = `${SESSIONS_ROUTE}/${session.id}/${path}`;
    await dataSource.query(arrange, [session.id, limit - 1]);
    const lock = await lockSession(dataSource, session.id, { table: 'reading.sessions' });

    const racing = [reader.post(route, body).then(), reader.post(route, body).then()];
    const waiting = await requestsWaitingForSessionLock(dataSource, 2, READING_SESSIONS_QUERY);
    await lock.commit();
    const responses = await Promise.all(racing);

    expect(waiting).toBe(2);
    expect(responses.map(({ status }) => status).toSorted()).toEqual([201, 409]);
    expect(await storedFor(dataSource, table)).toBe(limit);
  });
});
