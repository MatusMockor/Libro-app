import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import { WorkEntity } from '../../../src/modules/books/persistence/work.entity.js';
import type { ReadingSessionResponse } from '../../../src/modules/reading-sessions/http/reading-session.response.js';
import { ANY_ISO_DATE, ANY_UUID } from '../../support/matchers.js';
import { SESSIONS_ROUTE, storedCounts, test } from './reading-sessions.fixture.js';

const CURRENT_ROUTE = `${SESSIONS_ROUTE}/current`;

interface StoredSession {
  userId: string;
  readingUserId: string;
  workId: string;
  finished: boolean;
}

function storedSessions(dataSource: DataSource): Promise<StoredSession[]> {
  return dataSource.query<StoredSession[]>(
    `SELECT session.user_id AS "userId", reading.user_id AS "readingUserId",
            reading.work_id AS "workId", reading.finished_at IS NOT NULL AS finished
     FROM reading.sessions session
     JOIN reading.readings reading ON reading.id = session.reading_id`,
  );
}

describe('POST /v1/reading-sessions', () => {
  test('answers 401 authentication_required without an access token', async ({
    http,
    dataSource,
  }) => {
    const response = await http.post(SESSIONS_ROUTE).send({ workId: randomUUID() });

    expect(response.status).toBe(401);
    expect((response.body as ProblemDetails).code).toBe('authentication_required');
    expect(await storedCounts(dataSource)).toEqual({
      readings: 0,
      sessions: 0,
      checkpoints: 0,
      markedParts: 0,
    });
  });

  test('answers 201 with the new active session', async ({ reader }) => {
    const response = await reader.start({ place: 'kaviareň' });
    const session = response.body as ReadingSessionResponse;

    expect(response.status).toBe(201);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toStrictEqual({
      id: ANY_UUID,
      readingId: ANY_UUID,
      workId: reader.workId,
      place: 'kaviareň',
      status: 'active',
      startedAt: ANY_ISO_DATE,
      endedAt: null,
      activeSeconds: expect.any(Number) as number,
      checkpoints: [],
      markedParts: [],
      groupHostSessionId: null,
    });
    expect(session.activeSeconds).toBeLessThanOrEqual(1);
  });

  test('starts the session in a new unfinished reading of the user', async ({
    reader,
    dataSource,
  }) => {
    await reader.start();

    expect(await storedSessions(dataSource)).toEqual([
      { userId: reader.id, readingUserId: reader.id, workId: reader.workId, finished: false },
    ]);
  });

  test('starts the next session in the same unfinished reading', async ({ reader, dataSource }) => {
    const first = await reader.startedSession('ended');

    const second = (await reader.start()).body as ReadingSessionResponse;

    expect(second.id).not.toBe(first.id);
    expect(second.readingId).toBe(first.readingId);
    expect(await storedCounts(dataSource)).toMatchObject({ readings: 1, sessions: 2 });
  });

  test('keeps the readings of different users of the same book apart', async ({
    reader,
    newReader,
  }) => {
    const other = await newReader();
    const mine = (await reader.start()).body as ReadingSessionResponse;

    const response = await other.start({ workId: reader.workId });
    const theirs = response.body as ReadingSessionResponse;

    expect(response.status).toBe(201);
    expect(theirs.readingId).not.toBe(mine.readingId);
  });

  test('trims the place', async ({ reader }) => {
    const session = (await reader.start({ place: '  kaviareň na rohu  ' }))
      .body as ReadingSessionResponse;

    expect(session.place).toBe('kaviareň na rohu');
  });

  test('accepts a place of 100 characters after trimming', async ({ reader }) => {
    const place = 'p'.repeat(100);

    const response = await reader.start({ place: `  ${place}  ` });

    expect(response.status).toBe(201);
    expect((response.body as ReadingSessionResponse).place).toBe(place);
  });

  test.for([
    { name: 'a missing place', body: {} },
    { name: 'a null place', body: { place: null } },
    { name: 'an empty place', body: { place: '' } },
    { name: 'a blank place', body: { place: '   ' } },
  ])('stores no place for $name', async ({ body }, { reader, dataSource }) => {
    const session = (await reader.start(body)).body as ReadingSessionResponse;

    const places = await dataSource.query<{ place: string | null }[]>(
      'SELECT place FROM reading.sessions',
    );

    expect(session.place).toBeNull();
    expect(places).toEqual([{ place: null }]);
  });

  test.for([
    {
      problem: 'a missing workId',
      body: { workId: undefined },
      errors: [{ path: 'workId', code: 'invalid_type' }],
    },
    {
      problem: 'a workId that is not a UUID',
      body: { workId: 'dune' },
      errors: [{ path: 'workId', code: 'invalid_format' }],
    },
    {
      problem: 'a place over 100 characters',
      body: { place: 'p'.repeat(101) },
      errors: [{ path: 'place', code: 'too_big' }],
    },
    {
      problem: 'a place that is not text',
      body: { place: 42 },
      errors: [{ path: 'place', code: 'invalid_type' }],
    },
  ])('rejects $problem with 400', async ({ body, errors }, { reader, dataSource }) => {
    const response = await reader.start(body);
    const problem = response.body as ProblemDetails;

    expect(response.status).toBe(400);
    expect(problem.code).toBe('validation_failed');
    expect(problem.errors?.map(({ path, code }) => ({ path, code }))).toEqual(errors);
    expect(await storedCounts(dataSource)).toMatchObject({ readings: 0, sessions: 0 });
  });

  test('answers 404 book_not_found for a book that is not in the catalogue', async ({
    reader,
    dataSource,
  }) => {
    const workId = randomUUID();

    const response = await reader.start({ workId });

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: `No book with id ${workId} is in the catalogue.`,
      instance: SESSIONS_ROUTE,
      code: 'book_not_found',
    });
    expect(await storedCounts(dataSource)).toMatchObject({ readings: 0, sessions: 0 });
  });

  test.for(['active', 'paused'] as const)(
    'answers 409 reading_session_already_open while a %s session is open',
    async (status, { reader, dataSource }) => {
      await reader.startedSession(status);

      const response = await reader.start();

      expect(response.status).toBe(409);
      expect(response.body).toStrictEqual({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'Another reading session is still open. End it before starting a new one.',
        instance: SESSIONS_ROUTE,
        code: 'reading_session_already_open',
      });
      expect(await storedCounts(dataSource)).toMatchObject({ readings: 1, sessions: 1 });
    },
  );

  test('answers 409 for another book and keeps no reading of it', async ({
    reader,
    factories,
    dataSource,
  }) => {
    const otherWork = await factories.get(WorkEntity).save();
    await reader.start();

    const response = await reader.start({ workId: otherWork.id });

    expect(response.status).toBe(409);
    expect((response.body as ProblemDetails).code).toBe('reading_session_already_open');
    expect(await storedSessions(dataSource)).toEqual([
      { userId: reader.id, readingUserId: reader.id, workId: reader.workId, finished: false },
    ]);
    expect(await storedCounts(dataSource)).toMatchObject({ readings: 1, sessions: 1 });
  });

  test('answers 409 to the loser of two concurrent starts', async ({ reader, dataSource }) => {
    const responses = await Promise.all([reader.start(), reader.start()]);

    expect(responses.map(({ status }) => status).toSorted()).toEqual([201, 409]);
    expect(responses.map(({ body }) => (body as ProblemDetails).code)).toContain(
      'reading_session_already_open',
    );
    expect(await storedCounts(dataSource)).toMatchObject({ readings: 1, sessions: 1 });
  });
});

describe('GET /v1/reading-sessions/current', () => {
  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.get(CURRENT_ROUTE);

    expect(response.status).toBe(401);
    expect((response.body as ProblemDetails).code).toBe('authentication_required');
  });

  test('answers 404 reading_session_not_found without an open session', async ({ reader }) => {
    const response = await reader.get(CURRENT_ROUTE);

    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'No such reading session.',
      instance: CURRENT_ROUTE,
      code: 'reading_session_not_found',
    });
  });

  test.for(['active', 'paused'] as const)(
    'answers 200 with the %s session',
    async (status, { reader }) => {
      const session = await reader.startedSession(status);

      const response = await reader.get(CURRENT_ROUTE);

      expect(response.status).toBe(200);
      expect(response.body).toStrictEqual({
        ...session,
        activeSeconds: expect.any(Number) as number,
      });
    },
  );

  test('answers 404 once the session has ended', async ({ reader }) => {
    await reader.startedSession('ended');

    const response = await reader.get(CURRENT_ROUTE);

    expect(response.status).toBe(404);
    expect((response.body as ProblemDetails).code).toBe('reading_session_not_found');
  });

  test('never answers with the open session of another user', async ({ reader, newReader }) => {
    const other = await newReader();
    await other.start();

    const response = await reader.get(CURRENT_ROUTE);

    expect(response.status).toBe(404);
    expect((response.body as ProblemDetails).code).toBe('reading_session_not_found');
  });
});

describe('GET /v1/reading-sessions/:sessionId', () => {
  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.get(`${SESSIONS_ROUTE}/${randomUUID()}`);

    expect(response.status).toBe(401);
    expect((response.body as ProblemDetails).code).toBe('authentication_required');
  });

  test('answers 200 with an ended session', async ({ reader }) => {
    const session = await reader.startedSession('ended');

    const response = await reader.get(`${SESSIONS_ROUTE}/${session.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual(session);
  });

  test('answers 404 for a session of another user exactly like for an unknown id', async ({
    reader,
    newReader,
  }) => {
    const other = await newReader();
    const theirs = await other.startedSession();
    const unknownId = randomUUID();

    const foreign = await reader.get(`${SESSIONS_ROUTE}/${theirs.id}`);
    const unknown = await reader.get(`${SESSIONS_ROUTE}/${unknownId}`);

    expect(foreign.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect({ ...(foreign.body as ProblemDetails), instance: undefined }).toStrictEqual({
      ...(unknown.body as ProblemDetails),
      instance: undefined,
    });
    expect((foreign.body as ProblemDetails).code).toBe('reading_session_not_found');
  });

  test('answers 400 validation_failed for an id that is not a UUID', async ({ reader }) => {
    const response = await reader.get(`${SESSIONS_ROUTE}/not-a-uuid`);
    const problem = response.body as ProblemDetails;

    expect(response.status).toBe(400);
    expect(problem.code).toBe('validation_failed');
    expect(problem.errors?.map(({ path, code }) => ({ path, code }))).toEqual([
      { path: 'sessionId', code: 'invalid_format' },
    ]);
  });
});
