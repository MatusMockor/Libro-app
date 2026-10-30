import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ReviewRepository } from '../application/review-repository.js';
import type { ReviewPageQuery } from '../domain/review-page.js';
import type { NewReview, SavedReview, StoredReview } from '../domain/review.js';
import { cursorPositionOf } from './cursor-position.sql.js';
import { ReviewEntity } from './review.entity.js';

const RETURNED_COLUMNS = `
  reading_id AS "readingId",
  user_id AS "userId",
  work_id AS "workId",
  rating,
  text,
  finished_at AS "finishedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  ${cursorPositionOf('created_at')} AS "cursorAt"
`;

const INSERT_REVIEW = `
  INSERT INTO reviews.reviews
    (reading_id, user_id, work_id, rating, text, finished_at, created_at, updated_at)
  SELECT $1::uuid, $2::uuid, $3::uuid, $4::smallint, $5::text, $6::timestamptz, clock.now, clock.now
  FROM (SELECT clock_timestamp() AS now) AS clock
  ON CONFLICT (reading_id) DO NOTHING
  RETURNING ${RETURNED_COLUMNS}
`;

const REPLACE_REVIEW = `
  UPDATE reviews.reviews
  SET rating = $3, text = $4, updated_at = clock_timestamp()
  WHERE reading_id = $1 AND user_id = $2
  RETURNING ${RETURNED_COLUMNS}
`;

const SELECT_REVIEWS = `
  SELECT ${RETURNED_COLUMNS}
  FROM reviews.reviews
`;

const SELECT_VISIBLE_REVIEW = `${SELECT_REVIEWS}
  WHERE reading_id = $1 AND user_id = ANY ($2::uuid[])
`;

const PAGE = `
  AND ($2::timestamptz IS NULL OR (created_at, reading_id) < ($2::timestamptz, $3::uuid))
  ORDER BY created_at DESC, reading_id DESC
  LIMIT $4
`;

const SELECT_READER_PAGE = `${SELECT_REVIEWS}
  WHERE user_id = $1 ${PAGE}
`;

const SELECT_WORK_PAGE = `${SELECT_REVIEWS}
  WHERE work_id = $1 AND user_id = ANY ($5::uuid[]) ${PAGE}
`;

const DELETE_OWNED = `
  DELETE FROM reviews.reviews WHERE reading_id = $1 AND user_id = $2
`;

const DELETE_ALL_OF_USER = `
  DELETE FROM reviews.reviews WHERE user_id = $1
`;

@Injectable()
export class TypeOrmReviewRepository implements ReviewRepository {
  constructor(@InjectRepository(ReviewEntity) private readonly reviews: Repository<ReviewEntity>) {}

  save({
    readingId,
    userId,
    workId,
    rating,
    text,
    finishedAt,
  }: NewReview): Promise<SavedReview | undefined> {
    return this.reviews.manager.transaction(async (manager) => {
      const [created] = await manager.query<StoredReview[]>(INSERT_REVIEW, [
        readingId,
        userId,
        workId,
        rating,
        text,
        finishedAt,
      ]);
      if (created) {
        return { review: created, created: true };
      }

      const [replaced] = await manager.query<[StoredReview[], number]>(REPLACE_REVIEW, [
        readingId,
        userId,
        rating,
        text,
      ]);
      const [review] = replaced;

      return review && { review, created: false };
    });
  }

  async findVisible(
    readingId: string,
    readerIds: readonly string[],
  ): Promise<StoredReview | undefined> {
    const [review] = await this.reviews.query<StoredReview[]>(SELECT_VISIBLE_REVIEW, [
      readingId,
      readerIds,
    ]);

    return review;
  }

  async deleteOwned(userId: string, readingId: string): Promise<boolean> {
    const [, deleted] = await this.reviews.query<[unknown[], number]>(DELETE_OWNED, [
      readingId,
      userId,
    ]);

    return deleted > 0;
  }

  listByReader(userId: string, page: ReviewPageQuery): Promise<StoredReview[]> {
    return this.reviews.query<StoredReview[]>(SELECT_READER_PAGE, [
      userId,
      ...pageParameters(page),
    ]);
  }

  listByWork(
    workId: string,
    readerIds: readonly string[],
    page: ReviewPageQuery,
  ): Promise<StoredReview[]> {
    return this.reviews.query<StoredReview[]>(SELECT_WORK_PAGE, [
      workId,
      ...pageParameters(page),
      readerIds,
    ]);
  }

  async deleteAllOf(userId: string): Promise<void> {
    await this.reviews.query(DELETE_ALL_OF_USER, [userId]);
  }
}

function pageParameters({ after, limit }: ReviewPageQuery): [string | null, string | null, number] {
  return [after?.createdAt ?? null, after?.readingId ?? null, limit];
}
