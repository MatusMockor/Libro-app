import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  FinishOutcome,
  ReadingOwner,
  ReadingRepository,
} from '../application/reading-repository.js';
import type { Reading } from '../domain/reading.js';
import { ReadingEntity } from './reading.entity.js';

const LOCK_READING = `
  SELECT finished_at IS NOT NULL AS finished
  FROM reading.readings
  WHERE id = $1 AND user_id = $2
  FOR UPDATE
`;

const OPEN_SESSION_OF_READING = `
  SELECT 1 FROM reading.sessions WHERE reading_id = $1 AND status <> 'ended' LIMIT 1
`;

const FINISH_READING = `
  UPDATE reading.readings
  SET finished_at = clock_timestamp()
  WHERE id = $1
  RETURNING id, work_id AS "workId", started_at AS "startedAt", finished_at AS "finishedAt"
`;

const DELETE_READINGS_OF_USER = `
  DELETE FROM reading.readings WHERE user_id = $1
`;

const DELETE_SESSIONS_OF_USER = `
  DELETE FROM reading.sessions WHERE user_id = $1
`;

@Injectable()
export class TypeOrmReadingRepository implements ReadingRepository {
  constructor(
    @InjectRepository(ReadingEntity) private readonly readings: Repository<ReadingEntity>,
  ) {}

  finish({ userId, readingId }: ReadingOwner): Promise<FinishOutcome> {
    return this.readings.manager.transaction(async (manager) => {
      const [locked] = await manager.query<{ finished: boolean }[]>(LOCK_READING, [
        readingId,
        userId,
      ]);
      if (!locked) {
        return { kind: 'not_found' };
      }

      if (locked.finished) {
        return { kind: 'already_finished' };
      }

      const openSessions = await manager.query<unknown[]>(OPEN_SESSION_OF_READING, [readingId]);
      if (openSessions.length > 0) {
        return { kind: 'session_open' };
      }

      const [[reading]] = await manager.query<[[Reading], number]>(FINISH_READING, [readingId]);

      return { kind: 'finished', reading };
    });
  }

  async deleteAllOf(userId: string): Promise<void> {
    await this.readings.manager.transaction(async (manager) => {
      await manager.query(DELETE_READINGS_OF_USER, [userId]);
      await manager.query(DELETE_SESSIONS_OF_USER, [userId]);
    });
  }
}
