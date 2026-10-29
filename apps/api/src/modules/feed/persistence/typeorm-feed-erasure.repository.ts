import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { FeedErasureRepository } from '../application/feed-erasure-repository.js';
import { PostEntity } from './post.entity.js';

const LOCK_AUTHOR = `
  SELECT pg_advisory_xact_lock(hashtextextended('feed.posts/' || $1::text, 0))
`;

const DELETE_LIKES = `
  DELETE FROM feed.likes WHERE user_id = $1
`;

const DELETE_REACTIONS = `
  DELETE FROM feed.reactions WHERE user_id = $1
`;

const DELETE_POSTS = `
  DELETE FROM feed.posts WHERE author_id = $1
`;

@Injectable()
export class TypeOrmFeedErasureRepository implements FeedErasureRepository {
  constructor(@InjectRepository(PostEntity) private readonly posts: Repository<PostEntity>) {}

  eraseUser(userId: string): Promise<void> {
    return this.posts.manager.transaction(async (manager) => {
      await manager.query(LOCK_AUTHOR, [userId]);
      for (const statement of [DELETE_LIKES, DELETE_REACTIONS, DELETE_POSTS]) {
        await manager.query(statement, [userId]);
      }
    });
  }
}
