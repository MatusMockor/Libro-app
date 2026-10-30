import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DEADLOCK_RETRY_ATTEMPTS, retryOnDeadlock } from '../../../database/deadlock.js';
import type {
  EncouragementRepository,
  ReadingDecoration,
} from '../application/encouragement-repository.js';
import type { StoredEncouragement } from '../domain/encouragement.js';
import type { EncouragementListQuery } from '../domain/encouragement-page.js';
import { cursorPositionOf } from './cursor-position.sql.js';
import { InsightEntity } from './insight.entity.js';

function before(createdAt: string, decorationId: string): string {
  return `($3::timestamptz IS NULL
           OR ${createdAt} < $3::timestamptz
           OR (${createdAt} = $3::timestamptz AND (${decorationId}) COLLATE "C" < $4::text))`;
}

const INSIGHT_DECORATION_ID = `'insight:' || insight.id`;

const CONGRATULATION_DECORATION_ID = `'congratulation:' || congratulation.author_id`;

const SELECT_PAGE = `
  SELECT entry.*, ${cursorPositionOf('entry."createdAt"')} AS "cursorAt"
  FROM (
    (
      SELECT ${INSIGHT_DECORATION_ID} AS "decorationId",
             'insight' AS kind,
             insight.id AS "insightId",
             insight.author_id AS "authorId",
             insight.text,
             insight.created_at AS "createdAt"
      FROM encouragements.insights AS insight
      WHERE insight.reading_id = $1
        AND ($2::uuid IS NULL OR insight.author_id = $2::uuid)
        AND ${before('insight.created_at', INSIGHT_DECORATION_ID)}
      ORDER BY insight.created_at DESC, insight.id DESC
      LIMIT $5
    )
    UNION ALL
    (
      SELECT ${CONGRATULATION_DECORATION_ID},
             'congratulation',
             NULL::uuid,
             congratulation.author_id,
             NULL::text,
             congratulation.created_at
      FROM encouragements.congratulations AS congratulation
      WHERE congratulation.reading_id = $1
        AND ($2::uuid IS NULL OR congratulation.author_id = $2::uuid)
        AND ${before('congratulation.created_at', CONGRATULATION_DECORATION_ID)}
      ORDER BY congratulation.created_at DESC, congratulation.author_id DESC
      LIMIT $5
    )
  ) AS entry
  ORDER BY entry."createdAt" DESC, entry."decorationId" COLLATE "C" DESC
  LIMIT $5
`;

const SELECT_OLDEST_DECORATIONS = `
  SELECT reading.id AS "readingId", entry.id, entry.kind
  FROM unnest($1::uuid[]) AS reading (id)
  CROSS JOIN LATERAL (
    SELECT oldest.id, oldest.kind, oldest.created_at
    FROM (
      (
        SELECT ${INSIGHT_DECORATION_ID} AS id, 'insight' AS kind, insight.created_at
        FROM encouragements.insights AS insight
        WHERE insight.reading_id = reading.id
        ORDER BY insight.created_at, insight.id
        LIMIT $2
      )
      UNION ALL
      (
        SELECT ${CONGRATULATION_DECORATION_ID}, 'congratulation', congratulation.created_at
        FROM encouragements.congratulations AS congratulation
        WHERE congratulation.reading_id = reading.id
        ORDER BY congratulation.created_at, congratulation.author_id
        LIMIT $2
      )
    ) AS oldest
    ORDER BY oldest.created_at, oldest.id COLLATE "C"
    LIMIT $2
  ) AS entry
  ORDER BY reading.id, entry.created_at, entry.id COLLATE "C"
`;

const DELETE_INSIGHTS_OF_USER = `
  DELETE FROM encouragements.insights WHERE author_id = $1 OR reader_id = $1
`;

const DELETE_CONGRATULATIONS_OF_USER = `
  DELETE FROM encouragements.congratulations WHERE author_id = $1 OR reader_id = $1
`;

@Injectable()
export class TypeOrmEncouragementRepository implements EncouragementRepository {
  constructor(
    @InjectRepository(InsightEntity) private readonly insights: Repository<InsightEntity>,
  ) {}

  list({
    readingId,
    authorId,
    after,
    limit,
  }: EncouragementListQuery): Promise<StoredEncouragement[]> {
    return this.insights.query<StoredEncouragement[]>(SELECT_PAGE, [
      readingId,
      authorId,
      after?.createdAt ?? null,
      after?.decorationId ?? null,
      limit,
    ]);
  }

  oldestDecorations(
    readingIds: readonly string[],
    perReading: number,
  ): Promise<ReadingDecoration[]> {
    return this.insights.query<ReadingDecoration[]>(SELECT_OLDEST_DECORATIONS, [
      readingIds,
      perReading,
    ]);
  }

  deleteAllOf(userId: string): Promise<void> {
    return retryOnDeadlock(DEADLOCK_RETRY_ATTEMPTS, () => this.eraseInTransaction(userId));
  }

  private eraseInTransaction(userId: string): Promise<void> {
    return this.insights.manager.transaction(async (manager) => {
      for (const statement of [DELETE_INSIGHTS_OF_USER, DELETE_CONGRATULATIONS_OF_USER]) {
        await manager.query(statement, [userId]);
      }
    });
  }
}
