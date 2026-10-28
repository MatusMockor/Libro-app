import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import { lockSession, requestsWaitingForSessionLock } from '../../support/session-lock.js';
import { SESSIONS_ROUTE, test } from './reading-sessions.fixture.js';

const READING_SESSIONS_QUERY = '%reading.sessions%';

const BLOCKED_FOR_MS = 200;

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const blockedFor = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

interface RecordedAroundEnd {
  stored: number;
  afterEnd: number;
}

async function recordedAroundEnd(
  dataSource: DataSource,
  table: string,
  column: string,
): Promise<RecordedAroundEnd | undefined> {
  const [row] = await dataSource.query<RecordedAroundEnd[]>(
    `SELECT count(*)::int AS stored,
            (count(*) FILTER (WHERE record.${column} > session.ended_at))::int AS "afterEnd"
     FROM reading.${table} record
     JOIN reading.sessions session ON session.id = record.session_id`,
  );

  return row;
}

describe('reading session requests racing on the same session', () => {
  test('a resume blocked on the session lock does not count the wait as reading time', async ({
    reader,
    dataSource,
  }) => {
    const session = await reader.arrangeSession({
      status: 'paused',
      startedAt: new Date(Date.now() - TWO_HOURS_MS),
      activeSeconds: 600,
    });
    const lock = await lockSession(dataSource, session.id, { table: 'reading.sessions' });

    const resuming = reader.post(`${SESSIONS_ROUTE}/${session.id}/resume`).then();
    const waiting = await requestsWaitingForSessionLock(dataSource, 1, READING_SESSIONS_QUERY);
    await blockedFor(BLOCKED_FOR_MS);
    const [{ releasedAt }] = (await lock.connection.query(
      'SELECT clock_timestamp() AS "releasedAt"',
    )) as [{ releasedAt: Date }];
    await lock.commit();
    const resumed = await resuming;

    const [stored] = await dataSource.query<{ activeSince: Date }[]>(
      'SELECT active_since AS "activeSince" FROM reading.sessions WHERE id = $1',
      [session.id],
    );
    expect(waiting).toBe(1);
    expect(resumed.status).toBe(200);
    expect(stored?.activeSince.getTime()).toBeGreaterThanOrEqual(releasedAt.getTime());
  });

  test.for([
    {
      name: 'checkpoint',
      path: 'checkpoints',
      body: { page: 5 },
      table: 'checkpoints',
      column: 'recorded_at',
    },
    {
      name: 'marked part',
      path: 'marked-parts',
      body: { kind: 'good', fromPage: 1, toPage: 5 },
      table: 'marked_parts',
      column: 'created_at',
    },
  ])(
    'a $name racing an end lands before the end or is rejected',
    async ({ path, body, table, column }, { reader, dataSource }) => {
      const session = await reader.startedSession();
      const lock = await lockSession(dataSource, session.id, { table: 'reading.sessions' });

      const ending = reader.post(`${SESSIONS_ROUTE}/${session.id}/end`).then();
      const endWaiting = await requestsWaitingForSessionLock(dataSource, 1, READING_SESSIONS_QUERY);
      const progress = reader.post(`${SESSIONS_ROUTE}/${session.id}/${path}`, body).then();
      const waiting = await requestsWaitingForSessionLock(dataSource, 2, READING_SESSIONS_QUERY);
      await lock.commit();
      const [ended, racing] = await Promise.all([ending, progress]);

      expect([endWaiting, waiting]).toEqual([1, 2]);
      expect(ended.status).toBe(200);
      expect([201, 409]).toContain(racing.status);
      expect(await recordedAroundEnd(dataSource, table, column)).toEqual({
        stored: racing.status === 201 ? 1 : 0,
        afterEnd: 0,
      });
    },
  );
});
