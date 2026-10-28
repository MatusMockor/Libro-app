import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import { isUniqueViolation } from '../../../database/unique-violation.js';
import { ReadingSessionAlreadyOpenException } from '../application/reading-session-already-open.exception.js';
import type {
  NewReadingSession,
  ReadingSessionRepository,
  SessionOwner,
} from '../application/reading-session-repository.js';
import {
  CHECKPOINT_STATUSES,
  MARKING_STATUSES,
  type Checkpoint,
  type MarkedPart,
  type NewMarkedPart,
  type ReadingSession,
  type SessionStatus,
} from '../domain/reading-session.js';
import type { TransitionRule } from '../domain/session-transition.js';
import { ReadingSessionEntity, SESSIONS_OPEN_USER_ID_KEY } from './reading-session.entity.js';

const UPSERT_UNFINISHED_READING = `
  INSERT INTO reading.readings (user_id, work_id, started_at)
  VALUES ($1, $2, now())
  ON CONFLICT (user_id, work_id) WHERE finished_at IS NULL
  DO UPDATE SET user_id = excluded.user_id
  RETURNING id
`;

const INSERT_SESSION = `
  INSERT INTO reading.sessions (reading_id, user_id, place, status, started_at, active_since)
  VALUES ($1, $2, $3, 'active', now(), now())
  RETURNING id
`;

const SELECT_SESSION = `
  SELECT session.id,
         session.reading_id AS "readingId",
         reading.work_id AS "workId",
         session.place,
         session.status,
         session.started_at AS "startedAt",
         session.ended_at AS "endedAt",
         floor(
           session.active_seconds
           + coalesce(extract(epoch FROM clock_timestamp() - session.active_since), 0)
         )::int AS "activeSeconds"
  FROM reading.sessions AS session
  JOIN reading.readings AS reading ON reading.id = session.reading_id
  WHERE session.user_id = $1
`;

const SELECT_SESSION_BY_ID = `${SELECT_SESSION} AND session.id = $2`;

const SELECT_OPEN_SESSION = `${SELECT_SESSION} AND session.status <> 'ended'`;

const SELECT_CHECKPOINTS = `
  SELECT id, page, recorded_at AS "recordedAt"
  FROM reading.checkpoints
  WHERE session_id = $1
  ORDER BY recorded_at, id
`;

const SELECT_MARKED_PARTS = `
  SELECT id, kind, from_page AS "fromPage", to_page AS "toPage", created_at AS "createdAt"
  FROM reading.marked_parts
  WHERE session_id = $1
  ORDER BY created_at, id
`;

const LOCK_SESSION_FOR_UPDATE = `
  SELECT 1 FROM reading.sessions
  WHERE user_id = $1 AND id = $2 AND status = ANY ($3::text[])
  FOR UPDATE
`;

const LOCK_SESSION_FOR_SHARE = `
  SELECT 1 FROM reading.sessions
  WHERE user_id = $1 AND id = $2 AND status = ANY ($3::text[])
  FOR SHARE
`;

const TRANSITION_SESSION = `
  UPDATE reading.sessions AS session
  SET status = $2,
      active_seconds = session.active_seconds
        + coalesce(extract(epoch FROM clock.at - session.active_since), 0),
      active_since = CASE WHEN $2 = 'active' THEN clock.at END,
      ended_at = CASE WHEN $2 = 'ended' THEN clock.at END
  FROM (SELECT clock_timestamp() AS at) AS clock
  WHERE session.id = $1
`;

const INSERT_CHECKPOINT = `
  INSERT INTO reading.checkpoints (session_id, page, recorded_at)
  VALUES ($1, $2, clock_timestamp())
  RETURNING id, page, recorded_at AS "recordedAt"
`;

const INSERT_MARKED_PART = `
  INSERT INTO reading.marked_parts (session_id, kind, from_page, to_page, created_at)
  VALUES ($1, $2, $3, $4, clock_timestamp())
  RETURNING id, kind, from_page AS "fromPage", to_page AS "toPage", created_at AS "createdAt"
`;

type SessionRow = Omit<ReadingSession, 'checkpoints' | 'markedParts'>;

@Injectable()
export class TypeOrmReadingSessionRepository implements ReadingSessionRepository {
  constructor(
    @InjectRepository(ReadingSessionEntity)
    private readonly sessions: Repository<ReadingSessionEntity>,
  ) {}

  async start({ userId, workId, place }: NewReadingSession): Promise<string> {
    try {
      return await this.sessions.manager.transaction(async (manager) => {
        const [reading] = await manager.query<[{ id: string }]>(UPSERT_UNFINISHED_READING, [
          userId,
          workId,
        ]);
        const [session] = await manager.query<[{ id: string }]>(INSERT_SESSION, [
          reading.id,
          userId,
          place,
        ]);

        return session.id;
      });
    } catch (error) {
      if (isUniqueViolation(error, SESSIONS_OPEN_USER_ID_KEY)) {
        throw new ReadingSessionAlreadyOpenException();
      }

      throw error;
    }
  }

  async findById({ userId, sessionId }: SessionOwner): Promise<ReadingSession | undefined> {
    return this.withDetails(
      await this.sessions.query<SessionRow[]>(SELECT_SESSION_BY_ID, [userId, sessionId]),
    );
  }

  async findOpen(userId: string): Promise<ReadingSession | undefined> {
    return this.withDetails(await this.sessions.query<SessionRow[]>(SELECT_OPEN_SESSION, [userId]));
  }

  transition(owner: SessionOwner, rule: TransitionRule): Promise<boolean> {
    return this.sessions.manager.transaction(async (manager) => {
      if (!(await lockSession(manager, LOCK_SESSION_FOR_UPDATE, owner, rule.from))) {
        return false;
      }

      await manager.query(TRANSITION_SESSION, [owner.sessionId, rule.to]);
      return true;
    });
  }

  addCheckpoint(owner: SessionOwner, page: number): Promise<Checkpoint | undefined> {
    return this.sessions.manager.transaction(async (manager) => {
      if (!(await lockSession(manager, LOCK_SESSION_FOR_SHARE, owner, CHECKPOINT_STATUSES))) {
        return undefined;
      }

      const [checkpoint] = await manager.query<[Checkpoint]>(INSERT_CHECKPOINT, [
        owner.sessionId,
        page,
      ]);
      return checkpoint;
    });
  }

  addMarkedPart(
    owner: SessionOwner,
    { kind, fromPage, toPage }: NewMarkedPart,
  ): Promise<MarkedPart | undefined> {
    return this.sessions.manager.transaction(async (manager) => {
      if (!(await lockSession(manager, LOCK_SESSION_FOR_SHARE, owner, MARKING_STATUSES))) {
        return undefined;
      }

      const [marked] = await manager.query<[MarkedPart]>(INSERT_MARKED_PART, [
        owner.sessionId,
        kind,
        fromPage,
        toPage,
      ]);
      return marked;
    });
  }

  private async withDetails([session]: SessionRow[]): Promise<ReadingSession | undefined> {
    if (!session) {
      return undefined;
    }

    const checkpoints = await this.sessions.query<Checkpoint[]>(SELECT_CHECKPOINTS, [session.id]);
    const markedParts = await this.sessions.query<MarkedPart[]>(SELECT_MARKED_PARTS, [session.id]);

    return { ...session, checkpoints, markedParts };
  }
}

async function lockSession(
  manager: EntityManager,
  lockQuery: string,
  { userId, sessionId }: SessionOwner,
  statuses: readonly SessionStatus[],
): Promise<boolean> {
  const locked = await manager.query<unknown[]>(lockQuery, [userId, sessionId, statuses]);

  return locked.length > 0;
}
