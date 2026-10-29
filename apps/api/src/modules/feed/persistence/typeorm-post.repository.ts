import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CreatePostOutcome, PostRepository } from '../application/post-repository.js';
import type { FeedPageQuery } from '../domain/feed-page.js';
import type { NewPost, StoredPost } from '../domain/post.js';
import type { PostLimit } from '../domain/post-limit.js';
import { cursorPositionOf } from './cursor-position.sql.js';
import { PostEntity } from './post.entity.js';

const LOCK_AUTHOR = `
  SELECT pg_advisory_xact_lock(hashtextextended('feed.posts/' || $1::text, 0))
`;

const SELECT_CLOCK = `
  SELECT ${cursorPositionOf('clock_timestamp()')} AS now
`;

const INSERT_POST_BELOW_LIMIT = `
  INSERT INTO feed.posts (author_id, text, work_id, place, created_at)
  SELECT $1::uuid, $2::text, $3::uuid, $4::text, $7::timestamptz
  WHERE (
    SELECT count(*)
    FROM feed.posts
    WHERE author_id = $1 AND created_at > $7::timestamptz - make_interval(secs => $6)
  ) < $5
  RETURNING id
`;

const SELECT_RETRY_AFTER = `
  SELECT COALESCE(
           (
             SELECT GREATEST(
                      1,
                      ceil(extract(epoch FROM created_at + make_interval(secs => $3) - $4::timestamptz))
                    )::int
             FROM feed.posts
             WHERE author_id = $1 AND created_at > $4::timestamptz - make_interval(secs => $3)
             ORDER BY created_at DESC
             OFFSET $2::int - 1
             LIMIT 1
           ),
           1
         ) AS "retryAfterSeconds"
`;

const SELECT_POSTS = `
  SELECT post.id,
         post.author_id AS "authorId",
         post.text,
         post.work_id AS "workId",
         post.place,
         post.created_at AS "createdAt",
         ${cursorPositionOf('post.created_at')} AS "cursorAt",
         (SELECT count(*)::int FROM feed.likes AS l WHERE l.post_id = post.id) AS "likeCount",
         EXISTS (
           SELECT 1 FROM feed.likes AS l WHERE l.post_id = post.id AND l.user_id = $1
         ) AS "likedByMe",
         COALESCE(
           (
             SELECT json_agg(
                      json_build_object('key', r.reaction, 'count', r.count, 'reactedByMe', r.mine)
                    )
             FROM (
               SELECT reaction, count(*)::int AS count, bool_or(user_id = $1) AS mine
               FROM feed.reactions
               WHERE post_id = post.id
               GROUP BY reaction
             ) AS r
           ),
           '[]'::json
         ) AS reactions
  FROM feed.posts AS post
`;

const SELECT_POST = `${SELECT_POSTS}
  WHERE post.id = $2
`;

const PAGE = `
  AND ($2::timestamptz IS NULL OR (post.created_at, post.id) < ($2::timestamptz, $3::uuid))
  ORDER BY post.created_at DESC, post.id DESC
  LIMIT $4
`;

const SELECT_ALL_PAGE = `${SELECT_POSTS}
  WHERE TRUE ${PAGE}
`;

const SELECT_AUTHORS_PAGE = `${SELECT_POSTS}
  WHERE post.author_id = ANY ($5::uuid[]) ${PAGE}
`;

const DELETE_OWNED = `
  DELETE FROM feed.posts WHERE id = $1 AND author_id = $2
`;

@Injectable()
export class TypeOrmPostRepository implements PostRepository {
  constructor(@InjectRepository(PostEntity) private readonly posts: Repository<PostEntity>) {}

  create(
    { authorId, text, workId, place }: NewPost,
    { posts, windowSeconds }: PostLimit,
  ): Promise<CreatePostOutcome> {
    return this.posts.manager.transaction(async (manager) => {
      await manager.query(LOCK_AUTHOR, [authorId]);
      const [{ now }] = await manager.query<[{ now: string }]>(SELECT_CLOCK);
      const [created] = await manager.query<{ id: string }[]>(INSERT_POST_BELOW_LIMIT, [
        authorId,
        text,
        workId,
        place,
        posts,
        windowSeconds,
        now,
      ]);
      if (created) {
        return { kind: 'created', postId: created.id };
      }

      const [{ retryAfterSeconds }] = await manager.query<[{ retryAfterSeconds: number }]>(
        SELECT_RETRY_AFTER,
        [authorId, posts, windowSeconds, now],
      );

      return { kind: 'limit_reached', retryAfterSeconds };
    });
  }

  async find(viewerId: string, postId: string): Promise<StoredPost | undefined> {
    const [post] = await this.posts.query<StoredPost[]>(SELECT_POST, [viewerId, postId]);

    return post;
  }

  async deleteOwned(authorId: string, postId: string): Promise<boolean> {
    const [, deleted] = await this.posts.query<[unknown[], number]>(DELETE_OWNED, [
      postId,
      authorId,
    ]);

    return deleted === 1;
  }

  listAll(viewerId: string, page: FeedPageQuery): Promise<StoredPost[]> {
    return this.posts.query<StoredPost[]>(SELECT_ALL_PAGE, [viewerId, ...pageParameters(page)]);
  }

  listByAuthors(
    viewerId: string,
    authorIds: readonly string[],
    page: FeedPageQuery,
  ): Promise<StoredPost[]> {
    return this.posts.query<StoredPost[]>(SELECT_AUTHORS_PAGE, [
      viewerId,
      ...pageParameters(page),
      authorIds,
    ]);
  }
}

function pageParameters({ after, limit }: FeedPageQuery): unknown[] {
  return [after?.createdAt ?? null, after?.id ?? null, limit];
}
