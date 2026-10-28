import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type { ReadingSessionResponse } from '../../../src/modules/reading-sessions/http/reading-session.response.js';
import { ANY_ISO_DATE } from '../../support/matchers.js';
import { SESSIONS_ROUTE, test } from './reading-sessions.fixture.js';

const TEN_MINUTES = 10 * 60;

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const secondsAgo = (seconds: number): Date => new Date(Date.now() - seconds * 1000);

function storedStatus(dataSource: DataSource, sessionId: string): Promise<{ status: string }[]> {
  return dataSource.query<{ status: string }[]>(
    'SELECT status FROM reading.sessions WHERE id = $1',
    [sessionId],
  );
}

describe('POST /v1/reading-sessions/:sessionId/{pause,resume,end}', () => {
  test.for(['pause', 'resume', 'end'])(
    'answers 401 authentication_required to %s without an access token',
    async (transition, { http }) => {
      const response = await http.post(`${SESSIONS_ROUTE}/${randomUUID()}/${transition}`);

      expect(response.status).toBe(401);
      expect((response.body as ProblemDetails).code).toBe('authentication_required');
    },
  );

  test('pauses an active session', async ({ reader }) => {
    const session = await reader.startedSession();

    const response = await reader.post(`${SESSIONS_ROUTE}/${session.id}/pause`);

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      ...session,
      status: 'paused',
      activeSeconds: expect.any(Number) as number,
    });
  });

  test('resumes a paused session', async ({ reader }) => {
    const session = await reader.startedSession('paused');

    const response = await reader.post(`${SESSIONS_ROUTE}/${session.id}/resume`);

    expect(response.status).toBe(200);
    expect((response.body as ReadingSessionResponse).status).toBe('active');
  });

  test.for(['active', 'paused'] as const)('ends a %s session', async (status, { reader }) => {
    const session = await reader.startedSession(status);

    const response = await reader.post(`${SESSIONS_ROUTE}/${session.id}/end`);

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      ...session,
      status: 'ended',
      endedAt: ANY_ISO_DATE,
      activeSeconds: expect.any(Number) as number,
    });
  });

  test.for([
    { from: 'paused', transition: 'pause' },
    { from: 'active', transition: 'resume' },
    { from: 'ended', transition: 'pause' },
    { from: 'ended', transition: 'resume' },
    { from: 'ended', transition: 'end' },
  ] as const)(
    'answers 409 invalid_session_transition to $transition of a $from session',
    async ({ from, transition }, { reader, dataSource }) => {
      const session = await reader.startedSession(from);
      const route = `${SESSIONS_ROUTE}/${session.id}/${transition}`;

      const response = await reader.post(route);

      expect(response.status).toBe(409);
      expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(response.body).toStrictEqual({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'The reading session cannot make this change in its current state.',
        instance: route,
        code: 'invalid_session_transition',
      });
      expect(await storedStatus(dataSource, session.id)).toEqual([{ status: from }]);
    },
  );

  test.for(['pause', 'resume', 'end'])(
    'answers 404 to %s of a session of another user and leaves it as it is',
    async (transition, { reader, newReader, dataSource }) => {
      const other = await newReader();
      const theirs = await other.startedSession(transition === 'resume' ? 'paused' : 'active');

      const response = await reader.post(`${SESSIONS_ROUTE}/${theirs.id}/${transition}`);

      expect(response.status).toBe(404);
      expect((response.body as ProblemDetails).code).toBe('reading_session_not_found');
      expect(await storedStatus(dataSource, theirs.id)).toEqual([{ status: theirs.status }]);
    },
  );

  test('answers 404 reading_session_not_found for an unknown session', async ({ reader }) => {
    const route = `${SESSIONS_ROUTE}/${randomUUID()}/end`;

    const response = await reader.post(route);

    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'No such reading session.',
      instance: route,
      code: 'reading_session_not_found',
    });
  });

  test('answers 400 validation_failed for a session id that is not a UUID', async ({ reader }) => {
    const response = await reader.post(`${SESSIONS_ROUTE}/42/pause`);

    expect(response.status).toBe(400);
    expect((response.body as ProblemDetails).code).toBe('validation_failed');
  });

  test('lets only one of two concurrent pauses succeed', async ({ reader }) => {
    const session = await reader.startedSession();
    const route = `${SESSIONS_ROUTE}/${session.id}/pause`;

    const responses = await Promise.all([reader.post(route), reader.post(route)]);

    expect(responses.map(({ status }) => status).toSorted()).toEqual([200, 409]);
  });
});

describe('active reading time', () => {
  test('keeps counting while the session is active', async ({ reader }) => {
    const session = await reader.arrangeSession({ startedAt: secondsAgo(TEN_MINUTES) });

    const response = await reader.get(`${SESSIONS_ROUTE}/${session.id}`);
    const { activeSeconds } = response.body as ReadingSessionResponse;

    expect(activeSeconds).toBeGreaterThanOrEqual(TEN_MINUTES);
    expect(activeSeconds).toBeLessThan(TEN_MINUTES + 5);
  });

  test('stops counting when the session is paused', async ({ reader }) => {
    const session = await reader.arrangeSession({ startedAt: secondsAgo(TEN_MINUTES) });

    const paused = (await reader.post(`${SESSIONS_ROUTE}/${session.id}/pause`))
      .body as ReadingSessionResponse;
    const later = (await reader.get(`${SESSIONS_ROUTE}/${session.id}`))
      .body as ReadingSessionResponse;

    expect(paused.activeSeconds).toBeGreaterThanOrEqual(TEN_MINUTES);
    expect(paused.activeSeconds).toBeLessThan(TEN_MINUTES + 5);
    expect(later.activeSeconds).toBe(paused.activeSeconds);
  });

  test('leaves the time of a pause out', async ({ reader }) => {
    const session = await reader.arrangeSession({
      status: 'paused',
      startedAt: new Date(Date.now() - TWO_HOURS_MS),
      activeSeconds: TEN_MINUTES,
    });

    const resumed = (await reader.post(`${SESSIONS_ROUTE}/${session.id}/resume`))
      .body as ReadingSessionResponse;
    const ended = (await reader.post(`${SESSIONS_ROUTE}/${session.id}/end`))
      .body as ReadingSessionResponse;

    expect(resumed.activeSeconds).toBe(TEN_MINUTES);
    expect(ended.activeSeconds).toBeGreaterThanOrEqual(TEN_MINUTES);
    expect(ended.activeSeconds).toBeLessThan(TEN_MINUTES + 5);
  });

  test('adds every active stretch up', async ({ reader, dataSource }) => {
    const session = await reader.arrangeSession({
      startedAt: new Date(Date.now() - TWO_HOURS_MS),
      activeSeconds: TEN_MINUTES,
      activeSince: secondsAgo(TEN_MINUTES),
    });

    const ended = (await reader.post(`${SESSIONS_ROUTE}/${session.id}/end`))
      .body as ReadingSessionResponse;
    const [stored] = await dataSource.query<{ activeSince: Date | null }[]>(
      'SELECT active_since AS "activeSince" FROM reading.sessions WHERE id = $1',
      [session.id],
    );

    expect(ended.activeSeconds).toBeGreaterThanOrEqual(2 * TEN_MINUTES);
    expect(ended.activeSeconds).toBeLessThan(2 * TEN_MINUTES + 5);
    expect(stored?.activeSince).toBeNull();
  });
});

describe('SessionEnded', () => {
  test('is published once with the ids of the ended session', async ({ reader, recorder }) => {
    const session = await reader.startedSession();
    await reader.post(`${SESSIONS_ROUTE}/${session.id}/pause`);
    await reader.post(`${SESSIONS_ROUTE}/${session.id}/resume`);

    await reader.post(`${SESSIONS_ROUTE}/${session.id}/end`);
    await reader.post(`${SESSIONS_ROUTE}/${session.id}/end`);

    expect(recorder.all()).toEqual([
      {
        handler: 'reading-sessions.v1',
        event: {
          name: 'SessionEnded',
          version: 1,
          occurredAt: expect.any(Date) as Date,
          payload: {
            sessionId: session.id,
            readingId: session.readingId,
            userId: reader.id,
            workId: reader.workId,
          },
        },
      },
    ]);
  });

  test('is not published when another user tries to end the session', async ({
    reader,
    newReader,
    recorder,
  }) => {
    const other = await newReader();
    const theirs = await other.startedSession();

    await reader.post(`${SESSIONS_ROUTE}/${theirs.id}/end`);

    expect(recorder.all()).toEqual([]);
  });
});
