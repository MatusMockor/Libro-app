import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { LikeRepository } from '../application/like-repository.js';
import { LikeEntity } from './like.entity.js';

const LIKE = `
  WITH post AS (
    SELECT id FROM feed.posts WHERE id = $1 FOR KEY SHARE
  ), liked AS (
    INSERT INTO feed.likes (post_id, user_id)
    SELECT id, $2 FROM post
    ON CONFLICT (post_id, user_id) DO NOTHING
  )
  SELECT EXISTS (SELECT 1 FROM post) AS "postExists"
`;

const UNLIKE = `
  WITH removed AS (
    DELETE FROM feed.likes WHERE post_id = $1 AND user_id = $2
  )
  SELECT EXISTS (SELECT 1 FROM feed.posts WHERE id = $1) AS "postExists"
`;

@Injectable()
export class TypeOrmLikeRepository implements LikeRepository {
  constructor(@InjectRepository(LikeEntity) private readonly likes: Repository<LikeEntity>) {}

  like(postId: string, userId: string): Promise<boolean> {
    return this.postExistsAfter(LIKE, postId, userId);
  }

  unlike(postId: string, userId: string): Promise<boolean> {
    return this.postExistsAfter(UNLIKE, postId, userId);
  }

  private async postExistsAfter(sql: string, postId: string, userId: string): Promise<boolean> {
    const [{ postExists }] = await this.likes.query<[{ postExists: boolean }]>(sql, [
      postId,
      userId,
    ]);

    return postExists;
  }
}
