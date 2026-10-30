import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Reading } from '../domain/reading.js';
import type {
  EndedSession,
  ReadingHistory,
  ReadingHistoryQuery,
  ReadingSummary,
  ReadingWithSessions,
} from '../reading-history.js';
import { ReadingEntity } from './reading.entity.js';

const READING_COLUMNS = `
  SELECT id, work_id AS "workId", started_at AS "startedAt", finished_at AS "finishedAt"
  FROM reading.readings
`;

const SELECT_READING = `${READING_COLUMNS} WHERE user_id = $1 AND id = $2`;

const SELECT_READING_SUMMARY = `
  SELECT id AS "readingId", user_id AS "userId", work_id AS "workId", finished_at AS "finishedAt"
  FROM reading.readings
  WHERE id = $1 AND user_id = ANY ($2::uuid[])
`;

const SELECT_READINGS = `${READING_COLUMNS}
  WHERE user_id = $1 AND (finished_at IS NOT NULL) = $2
  ORDER BY coalesce(finished_at, started_at) DESC, id
  LIMIT $3 OFFSET $4
`;

const SELECT_ENDED_SESSIONS = `
  SELECT session.reading_id AS "readingId",
         floor(session.active_seconds)::int AS "activeSeconds",
         coalesce(
           (SELECT json_agg(json_build_object('page', checkpoint.page)
                            ORDER BY checkpoint.recorded_at, checkpoint.id)
            FROM reading.checkpoints AS checkpoint
            WHERE checkpoint.session_id = session.id),
           '[]'
         ) AS checkpoints,
         coalesce(
           (SELECT json_agg(json_build_object('kind', part.kind,
                                              'fromPage', part.from_page,
                                              'toPage', part.to_page)
                            ORDER BY part.created_at, part.id)
            FROM reading.marked_parts AS part
            WHERE part.session_id = session.id),
           '[]'
         ) AS "markedParts",
         array_remove(
           ARRAY[
             (SELECT membership.host_session_id
              FROM reading.session_participants AS membership
              WHERE membership.participant_session_id = session.id),
             (SELECT session.id
              WHERE EXISTS (SELECT 1 FROM reading.session_participants AS hosted
                            WHERE hosted.host_session_id = session.id))
           ],
           NULL
         )::text[] AS "groupHostSessionIds"
  FROM reading.sessions AS session
  WHERE session.reading_id = ANY ($1::uuid[]) AND session.status = 'ended'
  ORDER BY session.started_at, session.id
`;

interface EndedSessionRow extends EndedSession {
  readonly readingId: string;
}

@Injectable()
export class TypeOrmReadingHistoryRepository implements ReadingHistory {
  constructor(
    @InjectRepository(ReadingEntity) private readonly readings: Repository<ReadingEntity>,
  ) {}

  async findReading(userId: string, readingId: string): Promise<ReadingWithSessions | undefined> {
    const [reading] = await this.withSessions(
      await this.readings.query<Reading[]>(SELECT_READING, [userId, readingId]),
    );

    return reading;
  }

  async findReadingSummary(
    readingId: string,
    ownerIds: readonly string[],
  ): Promise<ReadingSummary | undefined> {
    const [summary] = await this.readings.query<ReadingSummary[]>(SELECT_READING_SUMMARY, [
      readingId,
      ownerIds,
    ]);

    return summary;
  }

  async listReadings(
    userId: string,
    { finished, limit, offset }: ReadingHistoryQuery,
  ): Promise<ReadingWithSessions[]> {
    return this.withSessions(
      await this.readings.query<Reading[]>(SELECT_READINGS, [userId, finished, limit, offset]),
    );
  }

  private async withSessions(readings: Reading[]): Promise<ReadingWithSessions[]> {
    if (readings.length === 0) {
      return [];
    }

    const rows = await this.readings.query<EndedSessionRow[]>(SELECT_ENDED_SESSIONS, [
      readings.map(({ id }) => id),
    ]);

    return readings.map((reading) => ({
      ...reading,
      sessions: rows
        .filter((row) => row.readingId === reading.id)
        .map(({ activeSeconds, checkpoints, markedParts, groupHostSessionIds }) => ({
          activeSeconds,
          checkpoints,
          markedParts,
          groupHostSessionIds,
        })),
    }));
  }
}
