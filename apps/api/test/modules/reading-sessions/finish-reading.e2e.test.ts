import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type {
  CheckpointResponse,
  MarkedPartResponse,
  ReadingSessionResponse,
} from '../../../src/modules/reading-sessions/http/reading-session.response.js';
import type { ReadingResponse } from '../../../src/modules/reading-sessions/http/reading.response.js';
import { ANY_ISO_DATE } from '../../support/matchers.js';
import { SESSIONS_ROUTE, test } from './reading-sessions.fixture.js';

const finishRoute = (readingId: string): string => `/v1/readings/${readingId}/finish`;

function finishedReadings(dataSource: DataSource): Promise<{ finished: boolean }[]> {
  return dataSource.query<{ finished: boolean }[]>(
    'SELECT finished_at IS NOT NULL AS finished FROM reading.readings ORDER BY started_at',
  );
}

describe('a reading from the first session to the finished book', () => {
  test('records the sessions and ends with the finished book', async ({ reader, recorder }) => {
    const started = (await reader.start({ place: 'vlak' })).body as ReadingSessionResponse;
    const sessionRoute = `${SESSIONS_ROUTE}/${started.id}`;
    const checkpoint = (await reader.post(`${sessionRoute}/checkpoints`, { page: 25 }))
      .body as CheckpointResponse;
    const part = (
      await reader.post(`${sessionRoute}/marked-parts`, { kind: 'slow', fromPage: 10, toPage: 20 })
    ).body as MarkedPartResponse;
    await reader.post(`${sessionRoute}/pause`);
    await reader.post(`${sessionRoute}/resume`);
    const ended = await reader.post(`${sessionRoute}/end`);

    const finished = await reader.post(finishRoute(started.readingId));

    expect(ended.status).toBe(200);
    expect(ended.body).toStrictEqual({
      id: started.id,
      readingId: started.readingId,
      workId: reader.workId,
      place: 'vlak',
      status: 'ended',
      startedAt: started.startedAt,
      endedAt: ANY_ISO_DATE,
      activeSeconds: expect.any(Number) as number,
      checkpoints: [checkpoint],
      markedParts: [part],
    });
    expect(finished.status).toBe(200);
    expect(finished.headers['content-type']).toMatch(/^application\/json/);
    expect(finished.body).toStrictEqual({
      id: started.readingId,
      workId: reader.workId,
      startedAt: started.startedAt,
      finishedAt: ANY_ISO_DATE,
    });
    expect(recorder.all().map(({ event }) => event.name)).toEqual(['SessionEnded', 'BookFinished']);
  });
});

describe('POST /v1/readings/:readingId/finish', () => {
  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.post(finishRoute(randomUUID()));

    expect(response.status).toBe(401);
    expect((response.body as ProblemDetails).code).toBe('authentication_required');
  });

  test('publishes BookFinished once with the ids of the finished reading', async ({
    reader,
    recorder,
  }) => {
    const session = await reader.startedSession('ended');
    recorder.clear();

    await reader.post(finishRoute(session.readingId));
    await reader.post(finishRoute(session.readingId));

    expect(recorder.all()).toEqual([
      {
        handler: 'reading-sessions.v1',
        event: {
          name: 'BookFinished',
          version: 1,
          occurredAt: expect.any(Date) as Date,
          payload: { readingId: session.readingId, userId: reader.id, workId: reader.workId },
        },
      },
    ]);
  });

  test.for(['active', 'paused'] as const)(
    'answers 409 reading_session_open while a session of the reading is %s',
    async (status, { reader, recorder, dataSource }) => {
      const session = await reader.startedSession(status);
      const route = finishRoute(session.readingId);

      const response = await reader.post(route);

      expect(response.status).toBe(409);
      expect(response.body).toStrictEqual({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail:
          'A reading session of this reading is still open. End it before finishing the book.',
        instance: route,
        code: 'reading_session_open',
      });
      expect(await finishedReadings(dataSource)).toEqual([{ finished: false }]);
      expect(recorder.all()).toEqual([]);
    },
  );

  test('answers 409 reading_already_finished to the second finish', async ({ reader }) => {
    const session = await reader.startedSession('ended');
    const route = finishRoute(session.readingId);
    const first = (await reader.post(route)).body as ReadingResponse;

    const response = await reader.post(route);

    expect(response.status).toBe(409);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'This reading is already finished.',
      instance: route,
      code: 'reading_already_finished',
    });
    expect(first.finishedAt).not.toBeNull();
  });

  test('lets only one of two concurrent finishes succeed', async ({ reader, recorder }) => {
    const session = await reader.startedSession('ended');
    recorder.clear();
    const route = finishRoute(session.readingId);

    const responses = await Promise.all([reader.post(route), reader.post(route)]);

    expect(responses.map(({ status }) => status).toSorted()).toEqual([200, 409]);
    expect(recorder.all()).toHaveLength(1);
  });

  test('starts a new reading of the book with the next session', async ({ reader, dataSource }) => {
    const first = await reader.startedSession('ended');
    await reader.post(finishRoute(first.readingId));

    const reread = await reader.startedSession('ended');
    const finished = await reader.post(finishRoute(reread.readingId));

    expect(reread.readingId).not.toBe(first.readingId);
    expect(reread.workId).toBe(first.workId);
    expect(finished.status).toBe(200);
    expect(await finishedReadings(dataSource)).toEqual([{ finished: true }, { finished: true }]);
  });

  test('answers 404 for a reading of another user exactly like for an unknown id', async ({
    reader,
    newReader,
    recorder,
    dataSource,
  }) => {
    const other = await newReader();
    const theirs = await other.startedSession('ended');
    recorder.clear();

    const foreign = await reader.post(finishRoute(theirs.readingId));
    const unknown = await reader.post(finishRoute(randomUUID()));

    for (const response of [foreign, unknown]) {
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        title: 'Not Found',
        detail: 'No such reading.',
        code: 'reading_not_found',
      });
    }
    expect(await finishedReadings(dataSource)).toEqual([{ finished: false }]);
    expect(recorder.all()).toEqual([]);
  });

  test('answers 400 validation_failed for a reading id that is not a UUID', async ({ reader }) => {
    const response = await reader.post(finishRoute('first-reading'));
    const problem = response.body as ProblemDetails;

    expect(response.status).toBe(400);
    expect(problem.errors?.map(({ path, code }) => ({ path, code }))).toEqual([
      { path: 'readingId', code: 'invalid_format' },
    ]);
  });
});
