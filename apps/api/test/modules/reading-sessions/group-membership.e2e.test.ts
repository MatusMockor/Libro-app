import { randomUUID } from 'node:crypto';
import { describe, expect } from 'vitest';
import type { DataSource } from 'typeorm';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type { ReadingSessionResponse } from '../../../src/modules/reading-sessions/http/reading-session.response.js';
import { lockSession, requestsWaitingForSessionLock } from '../../support/session-lock.js';
import {
  leaveRoute,
  participantRoute,
  sessionRoute,
  storedParticipations,
  test,
  type GroupReader,
  type NewGroupReader,
  type NewWork,
} from './reading-groups.fixture.js';

interface Group {
  readonly host: GroupReader;
  readonly member: GroupReader;
  readonly hostSession: ReadingSessionResponse;
  readonly memberSession: ReadingSessionResponse;
}

async function groupOfTwo(newGroupReader: NewGroupReader, newWork: NewWork): Promise<Group> {
  const host = await newGroupReader();
  const member = await newGroupReader();
  await member.follows(host);
  const hostSession = await host.startReading(await newWork());

  return { host, member, hostSession, memberSession: await member.joined(hostSession.id) };
}

const READING_SESSION_LOCK = '%reading.sessions%FOR UPDATE%';

async function waitingForSessionLocks(dataSource: DataSource): Promise<number> {
  const [row] = await dataSource.query<{ waiting: number }[]>(
    `SELECT count(*)::int AS waiting
     FROM pg_stat_activity
     WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'`,
  );

  return row?.waiting ?? 0;
}

const UNBLOCKED_WITHIN_MS = 2000;

function unlessBlocked<T>(request: PromiseLike<T>): Promise<T | 'blocked'> {
  return Promise.race([
    Promise.resolve(request),
    new Promise<'blocked'>((resolve) => {
      setTimeout(() => {
        resolve('blocked');
      }, UNBLOCKED_WITHIN_MS);
    }),
  ]);
}

function codeOf(body: unknown): string | undefined {
  return (body as ProblemDetails).code;
}

describe('POST /v1/reading-sessions/:sessionId/leave', () => {
  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.post(leaveRoute(randomUUID()));

    expect(response.status).toBe(401);
  });

  test('answers 200 with the session, which goes on alone', async ({
    dataSource,
    newGroupReader,
    newWork,
  }) => {
    const { host, member, hostSession, memberSession } = await groupOfTwo(newGroupReader, newWork);

    const response = await member.post(leaveRoute(memberSession.id));
    const checkpoint = await member.post(`${sessionRoute(memberSession.id)}/checkpoints`, {
      page: 4,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: memberSession.id,
      status: 'active',
      groupHostSessionId: null,
    });
    expect(checkpoint.status).toBe(201);
    expect((await host.session(hostSession.id)).groupHostSessionId).toBeNull();
    expect(await storedParticipations(dataSource)).toEqual([
      expect.objectContaining({ participantSessionId: memberSession.id, left: true }),
    ]);
  });

  test('answers 409 not_in_group a second time', async ({ newGroupReader, newWork }) => {
    const { member, memberSession } = await groupOfTwo(newGroupReader, newWork);
    await member.post(leaveRoute(memberSession.id));

    const response = await member.post(leaveRoute(memberSession.id));

    expect(response.status).toBe(409);
    expect(codeOf(response.body)).toBe('not_in_group');
  });

  test('answers 409 not_in_group for a host and for a solo session', async ({
    newGroupReader,
    newWork,
  }) => {
    const { host, hostSession } = await groupOfTwo(newGroupReader, newWork);
    const solo = await newGroupReader();
    const soloSession = await solo.startReading(await newWork());

    const hostLeaving = await host.post(leaveRoute(hostSession.id));
    const soloLeaving = await solo.post(leaveRoute(soloSession.id));

    expect([hostLeaving.status, soloLeaving.status]).toEqual([409, 409]);
    expect(codeOf(hostLeaving.body)).toBe('not_in_group');
  });

  test('answers 409 not_in_group after the host ended', async ({ newGroupReader, newWork }) => {
    const { host, member, hostSession, memberSession } = await groupOfTwo(newGroupReader, newWork);
    await host.ended(hostSession.id);

    const response = await member.post(leaveRoute(memberSession.id));

    expect(response.status).toBe(409);
  });

  test('answers 404 reading_session_not_found for the session of another user', async ({
    newGroupReader,
    newWork,
  }) => {
    const { host, memberSession } = await groupOfTwo(newGroupReader, newWork);

    const response = await host.post(leaveRoute(memberSession.id));

    expect(response.status).toBe(404);
    expect(codeOf(response.body)).toBe('reading_session_not_found');
  });
});

describe('DELETE /v1/reading-sessions/:hostSessionId/participants/:participantSessionId', () => {
  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.delete(participantRoute(randomUUID(), randomUUID()));

    expect(response.status).toBe(401);
  });

  test('answers 204 and the removed session goes on alone', async ({
    dataSource,
    newGroupReader,
    newWork,
  }) => {
    const { host, member, hostSession, memberSession } = await groupOfTwo(newGroupReader, newWork);

    const response = await host.delete(participantRoute(hostSession.id, memberSession.id));
    const removed = await member.session(memberSession.id);

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(removed).toMatchObject({ status: 'active', groupHostSessionId: null });
    expect(await storedParticipations(dataSource)).toEqual([
      expect.objectContaining({ participantSessionId: memberSession.id, removed: true }),
    ]);
  });

  test('answers 204 again for a participant already removed', async ({
    newGroupReader,
    newWork,
  }) => {
    const { host, hostSession, memberSession } = await groupOfTwo(newGroupReader, newWork);
    await host.delete(participantRoute(hostSession.id, memberSession.id));

    const response = await host.delete(participantRoute(hostSession.id, memberSession.id));

    expect(response.status).toBe(204);
  });

  test('answers 404 group_participant_not_found for a session that never joined', async ({
    newGroupReader,
    newWork,
  }) => {
    const { host, hostSession } = await groupOfTwo(newGroupReader, newWork);
    const other = await newGroupReader();
    const otherSession = await other.startReading(await newWork());

    const response = await host.delete(participantRoute(hostSession.id, otherSession.id));

    expect(response.status).toBe(404);
    expect(codeOf(response.body)).toBe('group_participant_not_found');
  });

  test('answers 404 reading_session_not_found to anyone but the host', async ({
    dataSource,
    newGroupReader,
    newWork,
  }) => {
    const { member, hostSession, memberSession } = await groupOfTwo(newGroupReader, newWork);

    const response = await member.delete(participantRoute(hostSession.id, memberSession.id));

    expect(response.status).toBe(404);
    expect(codeOf(response.body)).toBe('reading_session_not_found');
    expect(await storedParticipations(dataSource)).toEqual([
      expect.objectContaining({ removed: false }),
    ]);
  });

  test('answers 409 reading_session_ended for an ended host session', async ({
    newGroupReader,
    newWork,
  }) => {
    const { host, hostSession, memberSession } = await groupOfTwo(newGroupReader, newWork);
    await host.ended(hostSession.id);

    const response = await host.delete(participantRoute(hostSession.id, memberSession.id));

    expect(response.status).toBe(409);
    expect(codeOf(response.body)).toBe('reading_session_ended');
  });

  test('answers 404 for an unrelated session without waiting for its lock', async ({
    dataSource,
    newGroupReader,
    newWork,
  }) => {
    const { host, hostSession } = await groupOfTwo(newGroupReader, newWork);
    const other = await newGroupReader();
    const otherSession = await other.startReading(await newWork());
    const lock = await lockSession(dataSource, otherSession.id, { table: 'reading.sessions' });

    const removing = host.delete(participantRoute(hostSession.id, otherSession.id)).then();
    const response = await unlessBlocked(removing);
    const waiting = await waitingForSessionLocks(dataSource);
    await lock.commit();
    await removing;

    expect(response).not.toBe('blocked');
    expect(waiting).toBe(0);
    expect(response).toMatchObject({ status: 404, body: { code: 'group_participant_not_found' } });
  });

  test('crossed removals of a host and its participant never deadlock', async ({
    dataSource,
    newGroupReader,
    newWork,
  }) => {
    const { host, member, hostSession, memberSession } = await groupOfTwo(newGroupReader, newWork);
    const lock = await lockSession(dataSource, hostSession.id, { table: 'reading.sessions' });

    const byMember = member.delete(participantRoute(memberSession.id, hostSession.id)).then();
    const memberRemoval = await unlessBlocked(byMember);
    const waitingAfterMember = await waitingForSessionLocks(dataSource);
    const byHost = host.delete(participantRoute(hostSession.id, memberSession.id)).then();
    const hostWaiting = await requestsWaitingForSessionLock(dataSource, 1, READING_SESSION_LOCK);
    await lock.commit();
    const [hostRemoval] = await Promise.all([byHost, byMember]);

    expect(memberRemoval).not.toBe('blocked');
    expect([waitingAfterMember, hostWaiting]).toEqual([0, 1]);
    expect(memberRemoval).toMatchObject({
      status: 404,
      body: { code: 'group_participant_not_found' },
    });
    expect(hostRemoval.status).toBe(204);
    expect(await storedParticipations(dataSource)).toEqual([
      expect.objectContaining({ participantSessionId: memberSession.id, removed: true }),
    ]);
  });

  test('answers 400 validation_failed for ids that are not UUIDs', async ({ newGroupReader }) => {
    const host = await newGroupReader();

    const response = await host.delete('/v1/reading-sessions/dune/participants/kafka');

    expect(response.status).toBe(400);
    expect((response.body as ProblemDetails).errors?.map(({ path }) => path)).toEqual([
      'hostSessionId',
      'participantSessionId',
    ]);
  });
});
