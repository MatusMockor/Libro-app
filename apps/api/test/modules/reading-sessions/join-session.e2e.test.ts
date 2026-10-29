import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type { ReadingSessionResponse } from '../../../src/modules/reading-sessions/http/reading-session.response.js';
import { ANY_ISO_DATE, ANY_UUID } from '../../support/matchers.js';
import { lockSession, requestsWaitingForSessionLock } from '../../support/session-lock.js';
import {
  joinRoute,
  participantRoute,
  sessionRoute,
  storedParticipations,
  test,
  type GroupReader,
  type NewGroupReader,
} from './reading-groups.fixture.js';

const HOST_LOCK_QUERY = '%FOR UPDATE OF session%';

const BLOCKED_FOR_MS = 200;

interface Readers {
  readonly host: GroupReader;
  readonly joiner: GroupReader;
  readonly hostSession: ReadingSessionResponse;
}

async function hostAndFollower(newGroupReader: NewGroupReader, workId: string): Promise<Readers> {
  const host = await newGroupReader();
  const joiner = await newGroupReader();
  await joiner.follows(host);

  return { host, joiner, hostSession: await host.startReading(workId) };
}

function codeOf(body: unknown): string | undefined {
  return (body as ProblemDetails).code;
}

interface StoredSessionOfUser {
  readonly userId: string;
  readonly workId: string;
  readonly startedAt: Date;
}

async function storedSession(
  dataSource: DataSource,
  sessionId: string,
): Promise<StoredSessionOfUser | undefined> {
  const [row] = await dataSource.query<StoredSessionOfUser[]>(
    `SELECT session.user_id AS "userId", reading.work_id AS "workId", session.started_at AS "startedAt"
     FROM reading.sessions session
     JOIN reading.readings reading ON reading.id = session.reading_id
     WHERE session.id = $1`,
    [sessionId],
  );

  return row;
}

describe('POST /v1/reading-sessions/:sessionId/join', () => {
  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.post(joinRoute(randomUUID())).send({});

    expect(response.status).toBe(401);
    expect(codeOf(response.body)).toBe('authentication_required');
  });

  test('answers 201 with an own new session of the same book in the group of the host', async ({
    dataSource,
    newGroupReader,
    newWork,
  }) => {
    const { host, joiner, hostSession } = await hostAndFollower(newGroupReader, await newWork());

    const response = await joiner.post(joinRoute(hostSession.id), { place: '  park  ' });
    const joined = response.body as ReadingSessionResponse;

    expect(response.status).toBe(201);
    expect(joined).toStrictEqual({
      id: ANY_UUID,
      readingId: ANY_UUID,
      workId: hostSession.workId,
      place: 'park',
      status: 'active',
      startedAt: ANY_ISO_DATE,
      endedAt: null,
      activeSeconds: expect.any(Number) as number,
      checkpoints: [],
      markedParts: [],
      groupHostSessionId: hostSession.id,
    });
    expect(joined.id).not.toBe(hostSession.id);
    expect(joined.readingId).not.toBe(hostSession.readingId);
    expect(await storedSession(dataSource, joined.id)).toMatchObject({
      userId: joiner.id,
      workId: hostSession.workId,
    });
    expect((await host.session(hostSession.id)).groupHostSessionId).toBe(hostSession.id);
    expect(await storedParticipations(dataSource)).toEqual([
      {
        hostSessionId: hostSession.id,
        participantSessionId: joined.id,
        left: false,
        removed: false,
      },
    ]);
  });

  test('accepts a join without a body', async ({ http, newGroupReader, newWork }) => {
    const { joiner, hostSession } = await hostAndFollower(newGroupReader, await newWork());

    const response = await http
      .post(joinRoute(hostSession.id))
      .set('Authorization', joiner.authorization);

    expect(response.status).toBe(201);
    expect((response.body as ReadingSessionResponse).place).toBeNull();
  });

  test('attaches the session to the unfinished reading of the book of the joiner', async ({
    newGroupReader,
    newWork,
  }) => {
    const workId = await newWork();
    const { joiner, hostSession } = await hostAndFollower(newGroupReader, workId);
    const earlier = await joiner.startReading(workId);
    await joiner.ended(earlier.id);

    const joined = await joiner.joined(hostSession.id);

    expect(joined.readingId).toBe(earlier.readingId);
  });

  test('keeps an own timer for every member', async ({ newGroupReader, newWork }) => {
    const { host, joiner, hostSession } = await hostAndFollower(newGroupReader, await newWork());
    const joined = await joiner.joined(hostSession.id);

    const paused = await host.post(`${sessionRoute(hostSession.id)}/pause`);
    const checkpoint = await joiner.post(`${sessionRoute(joined.id)}/checkpoints`, { page: 3 });
    const joinerSession = await joiner.session(joined.id);
    const hostAfter = await host.session(hostSession.id);

    expect(paused.status).toBe(200);
    expect(checkpoint.status).toBe(201);
    expect(joinerSession.status).toBe('active');
    expect(hostAfter.status).toBe('paused');
    expect(hostAfter.checkpoints).toEqual([]);
  });

  test('joins the group of the host when joining one of its participants', async ({
    dataSource,
    newGroupReader,
    newWork,
  }) => {
    const { joiner: first, hostSession } = await hostAndFollower(newGroupReader, await newWork());
    const participant = await first.joined(hostSession.id);
    const second = await newGroupReader();
    await second.follows(first);

    const joined = await second.joined(participant.id);

    expect(joined.groupHostSessionId).toBe(hostSession.id);
    expect((await storedParticipations(dataSource)).map((row) => row.hostSessionId)).toEqual([
      hostSession.id,
      hostSession.id,
    ]);
  });

  test('makes a participant whose host ended the host of a new group', async ({
    newGroupReader,
    newWork,
  }) => {
    const {
      host,
      joiner: first,
      hostSession,
    } = await hostAndFollower(newGroupReader, await newWork());
    const participant = await first.joined(hostSession.id);
    await host.ended(hostSession.id);
    const second = await newGroupReader();
    await second.follows(first);

    const joined = await second.joined(participant.id);

    expect(joined.groupHostSessionId).toBe(participant.id);
    expect((await first.session(participant.id)).groupHostSessionId).toBe(participant.id);
  });

  test.for([
    {
      name: 'a reader the joiner does not follow',
      arrange: async (host: GroupReader, joiner: GroupReader) => {
        await joiner.put(`/v1/profiles/${host.id}/follow`);
        await joiner.delete(`/v1/profiles/${host.id}/follow`);
      },
    },
    {
      name: 'a reader who shares live sessions with nobody',
      arrange: async (host: GroupReader, joiner: GroupReader) => {
        await joiner.follows(host);
        await host.shareLiveSessions('nobody');
      },
    },
  ])(
    'answers 404 reading_session_not_found for a session of $name',
    async ({ arrange }, { dataSource, newGroupReader, newWork }) => {
      const host = await newGroupReader();
      const joiner = await newGroupReader();
      const hostSession = await host.startReading(await newWork());
      await arrange(host, joiner);

      const response = await joiner.post(joinRoute(hostSession.id));

      expect(response.status).toBe(404);
      expect(codeOf(response.body)).toBe('reading_session_not_found');
      expect(await storedParticipations(dataSource)).toEqual([]);
    },
  );

  test('answers 404 reading_session_not_found for an unknown session', async ({
    newGroupReader,
  }) => {
    const joiner = await newGroupReader();

    const response = await joiner.post(joinRoute(randomUUID()));

    expect(response.status).toBe(404);
    expect(codeOf(response.body)).toBe('reading_session_not_found');
  });

  test('answers 409 cannot_join_own_session for the own session', async ({
    newGroupReader,
    newWork,
  }) => {
    const host = await newGroupReader();
    const session = await host.startReading(await newWork());

    const response = await host.post(joinRoute(session.id));

    expect(response.status).toBe(409);
    expect(codeOf(response.body)).toBe('cannot_join_own_session');
  });

  test('answers 409 reading_session_already_open while the joiner reads another session', async ({
    dataSource,
    newGroupReader,
    newWork,
  }) => {
    const { joiner, hostSession } = await hostAndFollower(newGroupReader, await newWork());
    await joiner.startReading(await newWork());

    const response = await joiner.post(joinRoute(hostSession.id));

    expect(response.status).toBe(409);
    expect(codeOf(response.body)).toBe('reading_session_already_open');
    expect(await storedParticipations(dataSource)).toEqual([]);
  });

  test('answers an ended session of a followed reader exactly like an unknown one', async ({
    dataSource,
    newGroupReader,
    newWork,
  }) => {
    const { host, joiner, hostSession } = await hostAndFollower(newGroupReader, await newWork());
    await host.ended(hostSession.id);
    const unknown = await joiner.post(joinRoute(randomUUID()));

    const ended = await joiner.post(joinRoute(hostSession.id));
    await joiner.startReading(await newWork());
    const endedWhileReading = await joiner.post(joinRoute(hostSession.id));

    expect(unknown.status).toBe(404);
    for (const response of [ended, endedWhileReading]) {
      expect(response.status).toBe(404);
      expect({ ...(response.body as ProblemDetails), instance: undefined }).toStrictEqual({
        ...(unknown.body as ProblemDetails),
        instance: undefined,
      });
    }
    expect(await storedParticipations(dataSource)).toEqual([]);
  });

  test('answers 404 for an invisible session before telling that the joiner reads already', async ({
    newGroupReader,
    newWork,
  }) => {
    const host = await newGroupReader();
    const joiner = await newGroupReader();
    const hostSession = await host.startReading(await newWork());
    await joiner.startReading(await newWork());

    const response = await joiner.post(joinRoute(hostSession.id));

    expect(response.status).toBe(404);
    expect(codeOf(response.body)).toBe('reading_session_not_found');
  });

  test('answers 409 reading_session_ended when the host ends while the join waits for it', async ({
    dataSource,
    newGroupReader,
    newWork,
  }) => {
    const { joiner, hostSession } = await hostAndFollower(newGroupReader, await newWork());
    const lock = await lockSession(dataSource, hostSession.id, { table: 'reading.sessions' });

    const joining = joiner.post(joinRoute(hostSession.id)).then();
    const waiting = await requestsWaitingForSessionLock(dataSource, 1, HOST_LOCK_QUERY);
    await lock.connection.query(
      `UPDATE reading.sessions
       SET status = 'ended', ended_at = clock_timestamp(), active_since = NULL
       WHERE id = $1`,
      [hostSession.id],
    );
    await lock.commit();
    const response = await joining;

    expect(waiting).toBe(1);
    expect(response.status).toBe(409);
    expect(codeOf(response.body)).toBe('reading_session_ended');
    expect(await storedParticipations(dataSource)).toEqual([]);
  });

  test('answers 409 group_full when the group has 20 participants', async ({
    dataSource,
    newGroupReader,
    newWork,
    arrangeParticipants,
  }) => {
    const { joiner, hostSession } = await hostAndFollower(newGroupReader, await newWork());
    await arrangeParticipants(hostSession.id, 20);

    const response = await joiner.post(joinRoute(hostSession.id));

    expect(response.status).toBe(409);
    expect(codeOf(response.body)).toBe('group_full');
    expect(await storedParticipations(dataSource)).toHaveLength(20);
  });

  test('does not count participants who left, were removed or ended', async ({
    newGroupReader,
    newWork,
    arrangeParticipants,
  }) => {
    const { joiner, hostSession } = await hostAndFollower(newGroupReader, await newWork());
    const joinedAt = new Date(Date.now() - 60_000);
    await arrangeParticipants(hostSession.id, 17);
    await arrangeParticipants(hostSession.id, 1, { joinedAt, leftAt: new Date() });
    await arrangeParticipants(hostSession.id, 1, { joinedAt, removedAt: new Date() });

    const response = await joiner.post(joinRoute(hostSession.id));

    expect(response.status).toBe(201);
  });

  test('lets exactly one of two concurrent joins take the last place', async ({
    dataSource,
    newGroupReader,
    newWork,
    arrangeParticipants,
  }) => {
    const {
      host,
      joiner: first,
      hostSession,
    } = await hostAndFollower(newGroupReader, await newWork());
    const second = await newGroupReader();
    await second.follows(host);
    await arrangeParticipants(hostSession.id, 19);

    const responses = await Promise.all([
      first.post(joinRoute(hostSession.id)).then(),
      second.post(joinRoute(hostSession.id)).then(),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(responses.map(({ body }) => codeOf(body)).filter(Boolean)).toEqual(['group_full']);
    expect(await storedParticipations(dataSource)).toHaveLength(20);
  });

  test('samples the start time after waiting for the host lock', async ({
    dataSource,
    newGroupReader,
    newWork,
  }) => {
    const { joiner, hostSession } = await hostAndFollower(newGroupReader, await newWork());
    const lock = await lockSession(dataSource, hostSession.id, { table: 'reading.sessions' });

    const joining = joiner.post(joinRoute(hostSession.id)).then();
    const waiting = await requestsWaitingForSessionLock(dataSource, 1, HOST_LOCK_QUERY);
    await new Promise((resolve) => setTimeout(resolve, BLOCKED_FOR_MS));
    const [{ releasedAt }] = (await lock.connection.query(
      'SELECT clock_timestamp() AS "releasedAt"',
    )) as [{ releasedAt: Date }];
    await lock.commit();
    const joined = (await joining).body as ReadingSessionResponse;

    expect(waiting).toBe(1);
    expect(
      (await storedSession(dataSource, joined.id))?.startedAt.getTime(),
    ).toBeGreaterThanOrEqual(releasedAt.getTime());
  });

  test('answers 403 removed_from_group to a reader the host removed', async ({
    newGroupReader,
    newWork,
  }) => {
    const { host, joiner, hostSession } = await hostAndFollower(newGroupReader, await newWork());
    const joined = await joiner.joined(hostSession.id);
    await host.delete(participantRoute(hostSession.id, joined.id));
    await joiner.ended(joined.id);

    const response = await joiner.post(joinRoute(hostSession.id));

    expect(response.status).toBe(403);
    expect(codeOf(response.body)).toBe('removed_from_group');
  });

  test('lets a reader who left join again with a new session', async ({
    newGroupReader,
    newWork,
  }) => {
    const { joiner, hostSession } = await hostAndFollower(newGroupReader, await newWork());
    const joined = await joiner.joined(hostSession.id);
    await joiner.post(`${sessionRoute(joined.id)}/leave`);
    await joiner.ended(joined.id);

    const again = await joiner.joined(hostSession.id);

    expect(again.groupHostSessionId).toBe(hostSession.id);
  });

  test.for([
    {
      problem: 'a session id that is not a UUID',
      path: '/v1/reading-sessions/dune/join',
      body: {},
      error: { path: 'sessionId', code: 'invalid_format' },
    },
    {
      problem: 'a place over 100 characters',
      path: joinRoute(randomUUID()),
      body: { place: 'p'.repeat(101) },
      error: { path: 'place', code: 'too_big' },
    },
  ])(
    'answers 400 validation_failed for $problem',
    async ({ path, body, error }, { newGroupReader }) => {
      const joiner = await newGroupReader();

      const response = await joiner.post(path, body);

      expect(response.status).toBe(400);
      expect((response.body as ProblemDetails).errors).toEqual([expect.objectContaining(error)]);
    },
  );
});

describe('ending sessions of a group', () => {
  test('ending the host session leaves the participants reading alone', async ({
    newGroupReader,
    newWork,
  }) => {
    const { host, joiner, hostSession } = await hostAndFollower(newGroupReader, await newWork());
    const joined = await joiner.joined(hostSession.id);

    const ended = await host.ended(hostSession.id);
    const participant = await joiner.session(joined.id);
    const checkpoint = await joiner.post(`${sessionRoute(joined.id)}/checkpoints`, { page: 9 });

    expect(ended.groupHostSessionId).toBeNull();
    expect(participant).toMatchObject({ status: 'active', groupHostSessionId: null });
    expect(checkpoint.status).toBe(201);
  });

  test('a participant ending leaves the group of the host', async ({ newGroupReader, newWork }) => {
    const { host, joiner, hostSession } = await hostAndFollower(newGroupReader, await newWork());
    const joined = await joiner.joined(hostSession.id);

    const ended = await joiner.ended(joined.id);

    expect(ended.groupHostSessionId).toBeNull();
    expect((await host.session(hostSession.id)).groupHostSessionId).toBeNull();
  });
});
