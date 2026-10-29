import { randomUUID } from 'node:crypto';
import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type {
  CheckpointResponse,
  MarkedPartResponse,
  ReadingSessionResponse,
} from '../../../src/modules/reading-sessions/http/reading-session.response.js';
import { ANY_ISO_DATE, ANY_UUID } from '../../support/matchers.js';
import { SESSIONS_ROUTE, storedCounts, test } from './reading-sessions.fixture.js';

const checkpointsOf = (sessionId: string): string => `${SESSIONS_ROUTE}/${sessionId}/checkpoints`;

const markedPartsOf = (sessionId: string): string => `${SESSIONS_ROUTE}/${sessionId}/marked-parts`;

const GOOD_PART = { kind: 'good', fromPage: 12, toPage: 30 };

describe('POST /v1/reading-sessions/:sessionId/checkpoints', () => {
  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.post(checkpointsOf(randomUUID())).send({ page: 1 });

    expect(response.status).toBe(401);
    expect((response.body as ProblemDetails).code).toBe('authentication_required');
  });

  test('answers 201 with the checkpoint recorded in an active session', async ({ reader }) => {
    const session = await reader.startedSession();

    const response = await reader.post(checkpointsOf(session.id), { page: 42 });

    expect(response.status).toBe(201);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toStrictEqual({ id: ANY_UUID, page: 42, recordedAt: ANY_ISO_DATE });
  });

  test('lists the checkpoints of the session in the order they were recorded', async ({
    reader,
  }) => {
    const session = await reader.startedSession();
    const first = (await reader.post(checkpointsOf(session.id), { page: 10 }))
      .body as CheckpointResponse;
    const second = (await reader.post(checkpointsOf(session.id), { page: 4 }))
      .body as CheckpointResponse;

    const stored = (await reader.get(`${SESSIONS_ROUTE}/${session.id}`))
      .body as ReadingSessionResponse;

    expect(stored.checkpoints).toStrictEqual([first, second]);
  });

  test.for(['paused', 'ended'] as const)(
    'answers 409 reading_session_not_active in a %s session and stores nothing',
    async (status, { reader, dataSource }) => {
      const session = await reader.startedSession(status);
      const route = checkpointsOf(session.id);

      const response = await reader.post(route, { page: 42 });

      expect(response.status).toBe(409);
      expect(response.body).toStrictEqual({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'Checkpoints can be recorded only while the reading session is active.',
        instance: route,
        code: 'reading_session_not_active',
      });
      expect(await storedCounts(dataSource)).toMatchObject({ checkpoints: 0 });
    },
  );

  test('answers 404 for a session of another user and stores nothing', async ({
    reader,
    newReader,
    dataSource,
  }) => {
    const other = await newReader();
    const theirs = await other.startedSession();

    const response = await reader.post(checkpointsOf(theirs.id), { page: 42 });

    expect(response.status).toBe(404);
    expect((response.body as ProblemDetails).code).toBe('reading_session_not_found');
    expect(await storedCounts(dataSource)).toMatchObject({ checkpoints: 0 });
  });

  test('answers 404 for an unknown session', async ({ reader }) => {
    const response = await reader.post(checkpointsOf(randomUUID()), { page: 42 });

    expect(response.status).toBe(404);
    expect((response.body as ProblemDetails).code).toBe('reading_session_not_found');
  });

  test('accepts the first and the last page', async ({ reader }) => {
    const session = await reader.startedSession();

    const responses = [
      await reader.post(checkpointsOf(session.id), { page: 1 }),
      await reader.post(checkpointsOf(session.id), { page: 100_000 }),
    ];

    expect(responses.map(({ status }) => status)).toEqual([201, 201]);
  });

  test.for([
    { problem: 'page 0', body: { page: 0 }, code: 'too_small' },
    { problem: 'a negative page', body: { page: -3 }, code: 'too_small' },
    { problem: 'a page over 100000', body: { page: 100_001 }, code: 'too_big' },
    { problem: 'a fractional page', body: { page: 1.5 }, code: 'invalid_type' },
    { problem: 'a page given as text', body: { page: '5' }, code: 'invalid_type' },
    { problem: 'a missing page', body: {}, code: 'invalid_type' },
  ])('rejects $problem with 400', async ({ body, code }, { reader, dataSource }) => {
    const session = await reader.startedSession();

    const response = await reader.post(checkpointsOf(session.id), body);
    const problem = response.body as ProblemDetails;

    expect(response.status).toBe(400);
    expect(problem.code).toBe('validation_failed');
    expect(problem.errors?.map((error) => ({ path: error.path, code: error.code }))).toEqual([
      { path: 'page', code },
    ]);
    expect(await storedCounts(dataSource)).toMatchObject({ checkpoints: 0 });
  });
});

describe('POST /v1/reading-sessions/:sessionId/marked-parts', () => {
  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.post(markedPartsOf(randomUUID())).send(GOOD_PART);

    expect(response.status).toBe(401);
    expect((response.body as ProblemDetails).code).toBe('authentication_required');
  });

  test.for(['active', 'paused'] as const)(
    'answers 201 with the part marked in a %s session',
    async (status, { reader }) => {
      const session = await reader.startedSession(status);

      const response = await reader.post(markedPartsOf(session.id), GOOD_PART);

      expect(response.status).toBe(201);
      expect(response.body).toStrictEqual({ id: ANY_UUID, ...GOOD_PART, createdAt: ANY_ISO_DATE });
    },
  );

  test.for(['good', 'slow', 'skipped'])('accepts a %s part', async (kind, { reader }) => {
    const session = await reader.startedSession();

    const response = await reader.post(markedPartsOf(session.id), { ...GOOD_PART, kind });

    expect(response.status).toBe(201);
    expect((response.body as MarkedPartResponse).kind).toBe(kind);
  });

  test('accepts a part of a single page', async ({ reader }) => {
    const session = await reader.startedSession();

    const response = await reader.post(markedPartsOf(session.id), {
      kind: 'slow',
      fromPage: 7,
      toPage: 7,
    });

    expect(response.status).toBe(201);
  });

  test('lists the marked parts of the session in the order they were marked', async ({
    reader,
  }) => {
    const session = await reader.startedSession();
    const first = (await reader.post(markedPartsOf(session.id), GOOD_PART))
      .body as MarkedPartResponse;
    const second = (
      await reader.post(markedPartsOf(session.id), { kind: 'skipped', fromPage: 1, toPage: 3 })
    ).body as MarkedPartResponse;

    const stored = (await reader.get(`${SESSIONS_ROUTE}/${session.id}`))
      .body as ReadingSessionResponse;

    expect(stored.markedParts).toStrictEqual([first, second]);
  });

  test('answers 409 reading_session_ended in an ended session and stores nothing', async ({
    reader,
    dataSource,
  }) => {
    const session = await reader.startedSession('ended');
    const route = markedPartsOf(session.id);

    const response = await reader.post(route, GOOD_PART);

    expect(response.status).toBe(409);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'The reading session has ended.',
      instance: route,
      code: 'reading_session_ended',
    });
    expect(await storedCounts(dataSource)).toMatchObject({ markedParts: 0 });
  });

  test('answers 404 for a session of another user and stores nothing', async ({
    reader,
    newReader,
    dataSource,
  }) => {
    const other = await newReader();
    const theirs = await other.startedSession();

    const response = await reader.post(markedPartsOf(theirs.id), GOOD_PART);

    expect(response.status).toBe(404);
    expect((response.body as ProblemDetails).code).toBe('reading_session_not_found');
    expect(await storedCounts(dataSource)).toMatchObject({ markedParts: 0 });
  });

  test.for([
    {
      problem: 'fromPage greater than toPage',
      body: { ...GOOD_PART, fromPage: 31, toPage: 30 },
      errors: [{ path: 'toPage', code: 'custom' }],
    },
    {
      problem: 'fromPage 0',
      body: { ...GOOD_PART, fromPage: 0 },
      errors: [{ path: 'fromPage', code: 'too_small' }],
    },
    {
      problem: 'toPage over 100000',
      body: { ...GOOD_PART, toPage: 100_001 },
      errors: [{ path: 'toPage', code: 'too_big' }],
    },
    {
      problem: 'an unknown kind',
      body: { ...GOOD_PART, kind: 'boring' },
      errors: [{ path: 'kind', code: 'invalid_value' }],
    },
    {
      problem: 'a missing kind',
      body: { fromPage: 1, toPage: 2 },
      errors: [{ path: 'kind', code: 'invalid_value' }],
    },
  ])('rejects $problem with 400', async ({ body, errors }, { reader, dataSource }) => {
    const session = await reader.startedSession();

    const response = await reader.post(markedPartsOf(session.id), body);
    const problem = response.body as ProblemDetails;

    expect(response.status).toBe(400);
    expect(problem.code).toBe('validation_failed');
    expect(problem.errors?.map(({ path, code }) => ({ path, code }))).toEqual(errors);
    expect(await storedCounts(dataSource)).toMatchObject({ markedParts: 0 });
  });
});

describe('GET /v1/reading-sessions/:sessionId with arranged progress', () => {
  test('lists checkpoints and marked parts arranged by the factory in the supplied order', async ({
    reader,
  }) => {
    const session = await reader.arrangeSession({
      checkpointPages: [30, 10, 20],
      markedParts: [
        { kind: 'slow', fromPage: 40, toPage: 50 },
        { kind: 'good', fromPage: 1, toPage: 5 },
      ],
    });

    const response = await reader.get(`${SESSIONS_ROUTE}/${session.id}`);
    const body = response.body as ReadingSessionResponse;

    expect(response.status).toBe(200);
    expect(body.checkpoints.map(({ page }) => page)).toEqual([30, 10, 20]);
    expect(body.markedParts.map(({ kind }) => kind)).toEqual(['slow', 'good']);
  });
});
