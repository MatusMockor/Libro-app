import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import { isUniqueViolation } from '../../../database/unique-violation.js';
import type {
  JoinOutcome,
  JoinRequest,
  LeaveOutcome,
  ParticipantRemoval,
  ReadingGroupRepository,
  RemovalOutcome,
} from '../application/reading-group-repository.js';
import type { OpenedSession, SessionOwner } from '../application/reading-session-repository.js';
import { MAX_GROUP_PARTICIPANTS } from '../domain/reading-group.js';
import type { SessionStatus } from '../domain/reading-session.js';
import { ReadingSessionEntity, SESSIONS_OPEN_USER_ID_KEY } from './reading-session.entity.js';
import {
  currentGroupRootOf,
  currentParticipantsFrom,
  VIEWER_GROUP,
  visibleTo,
} from './session-groups.sql.js';

const JOIN_TARGET = `
  WITH ${VIEWER_GROUP}
  SELECT session.id AS "sessionId", session.user_id AS "ownerId"
  FROM reading.sessions AS session
  WHERE session.id = $3 AND ${visibleTo('session')}
`;

const GROUP_ROOT = `
  SELECT coalesce(${currentGroupRootOf('session')}, session.id) AS "rootId"
  FROM reading.sessions AS session
  WHERE session.id = $1
`;

const OPEN_SESSION_OF_USER = `
  SELECT 1 FROM reading.sessions WHERE user_id = $1 AND status <> 'ended'
`;

const LOCK_HOST = `
  SELECT session.status, reading.work_id AS "workId"
  FROM reading.sessions AS session
  JOIN reading.readings AS reading ON reading.id = session.reading_id
  WHERE session.id = $1
  FOR UPDATE OF session
`;

const REMOVED_FROM_GROUP = `
  SELECT 1
  FROM reading.session_participants AS participation
  JOIN reading.sessions AS member ON member.id = participation.participant_session_id
  WHERE participation.host_session_id = $1
    AND member.user_id = $2
    AND participation.removed_at IS NOT NULL
  LIMIT 1
`;

const COUNT_CURRENT_PARTICIPANTS = `
  SELECT count(*)::int AS count ${currentParticipantsFrom('$1')}
`;

const START_PARTICIPANT_SESSION = `
  WITH clock AS (SELECT clock_timestamp() AS at),
  reading AS (
    INSERT INTO reading.readings (user_id, work_id, started_at)
    SELECT $1, $2, clock.at FROM clock
    ON CONFLICT (user_id, work_id) WHERE finished_at IS NULL
    DO UPDATE SET user_id = excluded.user_id
    RETURNING id, (xmax = 0) AS created
  ),
  session AS (
    INSERT INTO reading.sessions (reading_id, user_id, place, status, started_at, active_since)
    SELECT reading.id, $1, $3, 'active', clock.at, clock.at FROM reading, clock
    RETURNING id, started_at
  ),
  participation AS (
    INSERT INTO reading.session_participants (host_session_id, participant_session_id, joined_at)
    SELECT $4, session.id, session.started_at FROM session
    RETURNING participant_session_id
  )
  SELECT participation.participant_session_id AS "sessionId",
         reading.id AS "readingId",
         reading.created AS "readingCreated"
  FROM participation, reading
`;

const OWNED_SESSION = `
  SELECT 1 FROM reading.sessions WHERE id = $2 AND user_id = $1
`;

const CURRENT_MEMBERSHIP = `
  SELECT host_session_id AS "hostSessionId"
  FROM reading.session_participants
  WHERE participant_session_id = $1 AND left_at IS NULL AND removed_at IS NULL
`;

const LOCK_OWNED_SESSION = `
  SELECT status FROM reading.sessions WHERE id = $2 AND user_id = $1 FOR UPDATE
`;

const LOCK_SESSION = `
  SELECT status FROM reading.sessions WHERE id = $1 FOR UPDATE
`;

const LEAVE_GROUP = `
  UPDATE reading.session_participants
  SET left_at = clock_timestamp()
  WHERE participant_session_id = $1
    AND host_session_id = $2
    AND left_at IS NULL
    AND removed_at IS NULL
  RETURNING 1
`;

const REMOVE_PARTICIPANT = `
  UPDATE reading.session_participants
  SET removed_at = clock_timestamp()
  WHERE host_session_id = $1 AND participant_session_id = $2 AND removed_at IS NULL
`;

const PARTICIPATION = `
  SELECT 1 FROM reading.session_participants
  WHERE host_session_id = $1 AND participant_session_id = $2
`;

interface JoinTarget {
  readonly sessionId: string;
  readonly ownerId: string;
}

interface LockedHost {
  readonly status: SessionStatus;
  readonly workId: string;
}

interface LockedGroup {
  readonly rootId: string;
  readonly host: LockedHost | undefined;
}

@Injectable()
export class TypeOrmReadingGroupRepository implements ReadingGroupRepository {
  constructor(
    @InjectRepository(ReadingSessionEntity)
    private readonly sessions: Repository<ReadingSessionEntity>,
  ) {}

  async join(request: JoinRequest): Promise<JoinOutcome> {
    try {
      return await this.sessions.manager.transaction((manager) => joinIn(manager, request));
    } catch (error) {
      if (isUniqueViolation(error, SESSIONS_OPEN_USER_ID_KEY)) {
        return { kind: 'already_open' };
      }

      throw error;
    }
  }

  leave({ userId, sessionId }: SessionOwner): Promise<LeaveOutcome> {
    return this.sessions.manager.transaction(async (manager) => {
      if (!(await exists(manager, OWNED_SESSION, [userId, sessionId]))) {
        return { kind: 'not_found' };
      }

      const [membership] = await manager.query<{ hostSessionId: string }[]>(CURRENT_MEMBERSHIP, [
        sessionId,
      ]);
      if (!membership) {
        return { kind: 'not_in_group' };
      }

      const [host] = await manager.query<{ status: SessionStatus }[]>(LOCK_SESSION, [
        membership.hostSessionId,
      ]);
      const [own] = await manager.query<{ status: SessionStatus }[]>(LOCK_OWNED_SESSION, [
        userId,
        sessionId,
      ]);
      if (host?.status === 'ended' || own?.status === 'ended') {
        return { kind: 'not_in_group' };
      }

      const left = await manager.query<[unknown[], number]>(LEAVE_GROUP, [
        sessionId,
        membership.hostSessionId,
      ]);

      return left[1] > 0 ? { kind: 'left' } : { kind: 'not_in_group' };
    });
  }

  removeParticipant({ host, participantSessionId }: ParticipantRemoval): Promise<RemovalOutcome> {
    return this.sessions.manager.transaction(async (manager) => {
      const [locked] = await manager.query<{ status: SessionStatus }[]>(LOCK_OWNED_SESSION, [
        host.userId,
        host.sessionId,
      ]);
      if (!locked) {
        return { kind: 'not_found' };
      }

      if (locked.status === 'ended') {
        return { kind: 'ended' };
      }

      if (!(await exists(manager, PARTICIPATION, [host.sessionId, participantSessionId]))) {
        return { kind: 'participant_not_found' };
      }

      await manager.query(LOCK_SESSION, [participantSessionId]);
      await manager.query(REMOVE_PARTICIPANT, [host.sessionId, participantSessionId]);

      return { kind: 'removed' };
    });
  }
}

async function joinIn(
  manager: EntityManager,
  { viewer, targetSessionId, place }: JoinRequest,
): Promise<JoinOutcome> {
  const [target] = await manager.query<JoinTarget[]>(JOIN_TARGET, [
    viewer.userId,
    viewer.followeeIds,
    targetSessionId,
  ]);
  if (!target) {
    return { kind: 'not_found' };
  }

  if (target.ownerId === viewer.userId) {
    return { kind: 'own_session' };
  }

  if (await exists(manager, OPEN_SESSION_OF_USER, [viewer.userId])) {
    return { kind: 'already_open' };
  }

  const { rootId, host } = await lockGroupOf(manager, target.sessionId);
  if (!host || host.status === 'ended') {
    return { kind: 'ended' };
  }

  if (await exists(manager, REMOVED_FROM_GROUP, [rootId, viewer.userId])) {
    return { kind: 'removed' };
  }

  const [{ count }] = await manager.query<[{ count: number }]>(COUNT_CURRENT_PARTICIPANTS, [
    rootId,
  ]);
  if (count >= MAX_GROUP_PARTICIPANTS) {
    return { kind: 'full' };
  }

  const [session] = await manager.query<[OpenedSession]>(START_PARTICIPANT_SESSION, [
    viewer.userId,
    host.workId,
    place,
    rootId,
  ]);

  return { kind: 'joined', session, workId: host.workId };
}

async function lockGroupOf(manager: EntityManager, sessionId: string): Promise<LockedGroup> {
  const rootId = await groupRootOf(manager, sessionId);
  const host = await lockHost(manager, rootId);
  if (rootId === sessionId || (await groupRootOf(manager, sessionId)) === rootId) {
    return { rootId, host };
  }

  return { rootId: sessionId, host: await lockHost(manager, sessionId) };
}

async function groupRootOf(manager: EntityManager, sessionId: string): Promise<string> {
  const [{ rootId }] = await manager.query<[{ rootId: string }]>(GROUP_ROOT, [sessionId]);

  return rootId;
}

async function lockHost(
  manager: EntityManager,
  sessionId: string,
): Promise<LockedHost | undefined> {
  const [host] = await manager.query<LockedHost[]>(LOCK_HOST, [sessionId]);

  return host;
}

async function exists(
  manager: EntityManager,
  query: string,
  parameters: readonly unknown[],
): Promise<boolean> {
  const rows = await manager.query<unknown[]>(query, [...parameters]);

  return rows.length > 0;
}
