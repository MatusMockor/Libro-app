import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { LiveSessionRepository } from '../application/live-session-repository.js';
import type {
  LivePageQuery,
  SessionViewer,
  StoredGroupMember,
  StoredLiveSession,
  StoredReadingGroup,
} from '../domain/reading-group.js';
import { ReadingSessionEntity } from './reading-session.entity.js';
import {
  audienceOf,
  currentGroupRootOf,
  currentParticipantsFrom,
  latestCheckpointPageOf,
  visibleParticipantCountOf,
  VIEWER_GROUP,
  visibleTo,
} from './session-groups.sql.js';

const SELECT_LIVE_SESSIONS = `
  WITH ${VIEWER_GROUP}
  SELECT session.id AS "sessionId",
         session.reading_id AS "readingId",
         session.user_id AS "userId",
         reading.work_id AS "workId",
         session.place,
         session.status,
         session.started_at AS "startedAt",
         ${latestCheckpointPageOf('session')} AS "progressPage",
         ${visibleParticipantCountOf('group_root.id')} AS "participantCount",
         EXISTS (
           SELECT 1 FROM viewer_group WHERE viewer_group.root = group_root.id
         ) AS "joinedByMe"
  FROM reading.sessions AS session
  JOIN reading.readings AS reading ON reading.id = session.reading_id
  CROSS JOIN LATERAL (SELECT ${currentGroupRootOf('session')} AS id) AS group_root
  WHERE session.user_id = ANY ($2::uuid[])
    AND session.status <> 'ended'
    AND ${audienceOf('session')}
  ORDER BY session.started_at DESC, session.id DESC
  LIMIT $3 OFFSET $4
`;

const SELECT_GROUP_OF_SESSION = `
  WITH ${VIEWER_GROUP}
  SELECT reading.work_id AS "workId",
         coalesce(${currentGroupRootOf('session')}, session.id) AS "hostSessionId"
  FROM reading.sessions AS session
  JOIN reading.readings AS reading ON reading.id = session.reading_id
  WHERE session.id = $3 AND ${visibleTo('session')}
`;

const SELECT_GROUP_MEMBERS = `
  WITH ${VIEWER_GROUP}
  SELECT member.id AS "sessionId",
         member.reading_id AS "readingId",
         member.user_id AS "userId",
         member.place,
         member.status,
         member.started_at AS "startedAt",
         ${latestCheckpointPageOf('member')} AS "progressPage",
         candidate.joined_at AS "joinedAt"
  FROM (
    SELECT $3::uuid AS session_id, NULL::timestamptz AS joined_at
    UNION ALL
    SELECT candidate_participation.participant_session_id, candidate_participation.joined_at
    ${currentParticipantsFrom('$3', 'candidate')}
  ) AS candidate
  JOIN reading.sessions AS member ON member.id = candidate.session_id
  WHERE ${visibleTo('member')}
  ORDER BY candidate.joined_at NULLS FIRST, member.id
`;

interface GroupOfSession {
  readonly workId: string;
  readonly hostSessionId: string;
}

@Injectable()
export class TypeOrmLiveSessionRepository implements LiveSessionRepository {
  constructor(
    @InjectRepository(ReadingSessionEntity)
    private readonly sessions: Repository<ReadingSessionEntity>,
  ) {}

  listLive(
    { userId, followeeIds }: SessionViewer,
    { limit, offset }: LivePageQuery,
  ): Promise<StoredLiveSession[]> {
    return this.sessions.query<StoredLiveSession[]>(SELECT_LIVE_SESSIONS, [
      userId,
      followeeIds,
      limit,
      offset,
    ]);
  }

  async findGroup(
    { userId, followeeIds }: SessionViewer,
    sessionId: string,
  ): Promise<StoredReadingGroup | undefined> {
    const [group] = await this.sessions.query<GroupOfSession[]>(SELECT_GROUP_OF_SESSION, [
      userId,
      followeeIds,
      sessionId,
    ]);
    if (!group) {
      return undefined;
    }

    const members = await this.sessions.query<StoredGroupMember[]>(SELECT_GROUP_MEMBERS, [
      userId,
      followeeIds,
      group.hostSessionId,
    ]);

    return { ...group, members };
  }
}
