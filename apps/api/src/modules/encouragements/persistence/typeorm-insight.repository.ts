import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  AddInsightOutcome,
  InsightLimit,
  InsightRepository,
} from '../application/insight-repository.js';
import type { NewInsight, StoredInsight } from '../domain/insight.js';
import { InsightEntity } from './insight.entity.js';
import { LOCK_READING } from './reading-lock.sql.js';

const INSERT_INSIGHT_BELOW_LIMIT = `
  INSERT INTO encouragements.insights (reading_id, reader_id, author_id, text, created_at)
  SELECT $2::uuid, $3::uuid, $1::uuid, $4::text, clock_timestamp()
  WHERE (
    SELECT count(*) FROM encouragements.insights WHERE author_id = $1 AND reading_id = $2
  ) < $5
  RETURNING id,
            reading_id AS "readingId",
            reader_id AS "readerId",
            author_id AS "authorId",
            text,
            created_at AS "createdAt"
`;

const DELETE_MANAGED = `
  DELETE FROM encouragements.insights
  WHERE id = $1 AND (author_id = $2 OR reader_id = $2)
`;

@Injectable()
export class TypeOrmInsightRepository implements InsightRepository {
  constructor(
    @InjectRepository(InsightEntity) private readonly insights: Repository<InsightEntity>,
  ) {}

  add(
    { readingId, readerId, authorId, text }: NewInsight,
    { perAuthorAndReading }: InsightLimit,
  ): Promise<AddInsightOutcome> {
    return this.insights.manager.transaction(async (manager) => {
      await manager.query(LOCK_READING, [readingId]);
      const [insight] = await manager.query<StoredInsight[]>(INSERT_INSIGHT_BELOW_LIMIT, [
        authorId,
        readingId,
        readerId,
        text,
        perAuthorAndReading,
      ]);

      return insight ? { kind: 'added', insight } : { kind: 'limit_reached' };
    });
  }

  async deleteManagedBy(userId: string, insightId: string): Promise<boolean> {
    const [, deleted] = await this.insights.query<[unknown[], number]>(DELETE_MANAGED, [
      insightId,
      userId,
    ]);

    return deleted === 1;
  }
}
