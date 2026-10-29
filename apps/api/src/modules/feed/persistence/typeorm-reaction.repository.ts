import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ReactionRepository } from '../application/reaction-repository.js';
import type { FeedPageQuery } from '../domain/feed-page.js';
import type { ReactionTarget, StoredReaction } from '../domain/reaction.js';
import { cursorPositionOf } from './cursor-position.sql.js';
import { ReactionEntity } from './reaction.entity.js';

const ADD = `
  WITH post AS (
    SELECT id FROM feed.posts WHERE id = $1 FOR KEY SHARE
  ), added AS (
    INSERT INTO feed.reactions (post_id, user_id, reaction)
    SELECT id, $2, $3 FROM post
    ON CONFLICT (post_id, user_id, reaction) DO NOTHING
  )
  SELECT EXISTS (SELECT 1 FROM post) AS "postExists"
`;

const REMOVE = `
  WITH removed AS (
    DELETE FROM feed.reactions WHERE post_id = $1 AND user_id = $2 AND reaction = $3
  )
  SELECT EXISTS (SELECT 1 FROM feed.posts WHERE id = $1) AS "postExists"
`;

const POST_EXISTS = `
  SELECT EXISTS (SELECT 1 FROM feed.posts WHERE id = $1) AS "postExists"
`;

const SELECT_PAGE = `
  SELECT id,
         user_id AS "userId",
         reaction AS key,
         created_at AS "createdAt",
         ${cursorPositionOf('created_at')} AS "cursorAt"
  FROM feed.reactions
  WHERE post_id = $1
    AND ($2::timestamptz IS NULL OR (created_at, id) < ($2::timestamptz, $3::uuid))
  ORDER BY created_at DESC, id DESC
  LIMIT $4
`;

@Injectable()
export class TypeOrmReactionRepository implements ReactionRepository {
  constructor(
    @InjectRepository(ReactionEntity) private readonly reactions: Repository<ReactionEntity>,
  ) {}

  add(target: ReactionTarget): Promise<boolean> {
    return this.postExistsAfter(ADD, target);
  }

  remove(target: ReactionTarget): Promise<boolean> {
    return this.postExistsAfter(REMOVE, target);
  }

  async listOf(
    postId: string,
    { after, limit }: FeedPageQuery,
  ): Promise<StoredReaction[] | undefined> {
    const [{ postExists }] = await this.reactions.query<[{ postExists: boolean }]>(POST_EXISTS, [
      postId,
    ]);
    if (!postExists) {
      return undefined;
    }

    return this.reactions.query<StoredReaction[]>(SELECT_PAGE, [
      postId,
      after?.createdAt ?? null,
      after?.id ?? null,
      limit,
    ]);
  }

  private async postExistsAfter(
    sql: string,
    { postId, userId, key }: ReactionTarget,
  ): Promise<boolean> {
    const [{ postExists }] = await this.reactions.query<[{ postExists: boolean }]>(sql, [
      postId,
      userId,
      key,
    ]);

    return postExists;
  }
}
