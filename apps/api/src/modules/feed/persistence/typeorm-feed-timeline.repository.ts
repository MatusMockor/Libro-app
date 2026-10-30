import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { FeedTimeline } from '../application/feed-timeline.js';
import {
  POST_ACTIVITY,
  READING_ACTIVITY_KINDS,
  type NewReadingActivity,
  type StoredActivity,
} from '../domain/activity.js';
import type { TimelineAudience } from '../domain/activity-feed.js';
import type { FeedPageQuery } from '../domain/feed-page.js';
import { ActivityEntity } from './activity.entity.js';
import { cursorPositionOf } from './cursor-position.sql.js';

const ACTIVITY_COLUMNS = `
  activity.id,
  activity.kind,
  activity.actor_id AS "actorId",
  activity.post_id AS "postId",
  activity.reading_id AS "readingId",
  activity.work_id AS "workId",
  activity.created_at AS "createdAt",
  ${cursorPositionOf('activity.created_at')} AS "cursorAt"
`;

const BEFORE_CURSOR = `
  ($5::timestamptz IS NULL OR (activity.created_at, activity.id) < ($5::timestamptz, $6::uuid))
`;

const NEWEST_FIRST = 'ORDER BY "createdAt" DESC, id DESC LIMIT $7';

const SELECT_VISIBLE_PAGE = `
  (SELECT ${ACTIVITY_COLUMNS}
   FROM feed.activities AS activity
   WHERE $1::boolean AND activity.kind = '${POST_ACTIVITY}' AND ${BEFORE_CURSOR}
   ${NEWEST_FIRST})
  UNION ALL
  (SELECT ${ACTIVITY_COLUMNS}
   FROM feed.activities AS activity
   WHERE NOT $1::boolean
     AND activity.kind = '${POST_ACTIVITY}'
     AND activity.actor_id = ANY ($2::uuid[])
     AND ${BEFORE_CURSOR}
   ${NEWEST_FIRST})
  UNION ALL
  (SELECT ${ACTIVITY_COLUMNS}
   FROM feed.activities AS activity
   WHERE activity.kind = ANY ($3::text[])
     AND activity.actor_id = ANY ($4::uuid[])
     AND ${BEFORE_CURSOR}
   ${NEWEST_FIRST})
  ${NEWEST_FIRST}
`;

const INSERT_READING_ACTIVITY = `
  INSERT INTO feed.activities (actor_id, kind, reading_id, work_id, created_at)
  VALUES ($1, $2, $3, $4, clock_timestamp())
  ON CONFLICT (kind, reading_id) DO NOTHING
`;

@Injectable()
export class TypeOrmFeedTimelineRepository implements FeedTimeline {
  constructor(
    @InjectRepository(ActivityEntity) private readonly activities: Repository<ActivityEntity>,
  ) {}

  page(
    { everyonesPosts, postAuthorIds, readingActorIds }: TimelineAudience,
    { after, limit }: FeedPageQuery,
  ): Promise<StoredActivity[]> {
    return this.activities.query<StoredActivity[]>(SELECT_VISIBLE_PAGE, [
      everyonesPosts,
      postAuthorIds,
      READING_ACTIVITY_KINDS,
      readingActorIds,
      after?.createdAt ?? null,
      after?.id ?? null,
      limit,
    ]);
  }

  async recordReading({ kind, actorId, readingId, workId }: NewReadingActivity): Promise<void> {
    await this.activities.query(INSERT_READING_ACTIVITY, [actorId, kind, readingId, workId]);
  }
}
