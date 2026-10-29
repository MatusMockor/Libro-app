import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  FollowRepository,
  NewFollow,
  UnfollowResult,
} from '../application/follow-repository.js';
import { decideFollow, type FollowDecision } from '../domain/follow.js';
import { FollowEntity } from './follow.entity.js';

const LOCK_FOLLOWER = `
  SELECT pg_advisory_xact_lock(hashtextextended('profiles.follows/' || $1::text, 0))
`;

const LOCK_FOLLOWEE = `
  SELECT user_id FROM profiles.profiles WHERE user_id = $1 FOR KEY SHARE
`;

const SELECT_FOLLOWING_STATE = `
  SELECT EXISTS (
           SELECT 1 FROM profiles.follows WHERE follower_id = $1 AND followee_id = $2
         ) AS following,
         (SELECT count(*)::int FROM profiles.follows WHERE follower_id = $1) AS "followingCount"
`;

const INSERT_FOLLOW = `
  INSERT INTO profiles.follows (follower_id, followee_id)
  VALUES ($1, $2)
  ON CONFLICT (follower_id, followee_id) DO NOTHING
`;

const DELETE_FOLLOW = `
  WITH removed AS (
    DELETE FROM profiles.follows WHERE follower_id = $1 AND followee_id = $2
  )
  SELECT EXISTS (SELECT 1 FROM profiles.profiles WHERE user_id = $2) AS "followeeExists"
`;

const SELECT_IS_FOLLOWING = `
  SELECT EXISTS (
    SELECT 1 FROM profiles.follows WHERE follower_id = $1 AND followee_id = $2
  ) AS following
`;

const SELECT_FOLLOWEE_IDS = `
  SELECT followee_id AS "followeeId"
  FROM profiles.follows
  WHERE follower_id = $1
  ORDER BY created_at DESC, followee_id
  LIMIT $2
`;

interface FollowingState {
  readonly following: boolean;
  readonly followingCount: number;
}

@Injectable()
export class TypeOrmFollowRepository implements FollowRepository {
  constructor(@InjectRepository(FollowEntity) private readonly follows: Repository<FollowEntity>) {}

  follow({ followerId, followeeId, limit }: NewFollow): Promise<FollowDecision> {
    return this.follows.manager.transaction(async (manager) => {
      await manager.query(LOCK_FOLLOWER, [followerId]);
      const followee = await manager.query<unknown[]>(LOCK_FOLLOWEE, [followeeId]);
      const [state] = await manager.query<[FollowingState]>(SELECT_FOLLOWING_STATE, [
        followerId,
        followeeId,
      ]);
      const decision = decideFollow({ ...state, followeeExists: followee.length > 0 }, limit);
      if (decision === 'followed') {
        await manager.query(INSERT_FOLLOW, [followerId, followeeId]);
      }

      return decision;
    });
  }

  async unfollow(followerId: string, followeeId: string): Promise<UnfollowResult> {
    const [{ followeeExists }] = await this.follows.query<[{ followeeExists: boolean }]>(
      DELETE_FOLLOW,
      [followerId, followeeId],
    );

    return followeeExists ? 'unfollowed' : 'followee_not_found';
  }

  async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    const [{ following }] = await this.follows.query<[{ following: boolean }]>(
      SELECT_IS_FOLLOWING,
      [followerId, followeeId],
    );

    return following;
  }

  async followeeIdsOf(userId: string, limit: number): Promise<string[]> {
    const rows = await this.follows.query<{ followeeId: string }[]>(SELECT_FOLLOWEE_IDS, [
      userId,
      limit,
    ]);

    return rows.map(({ followeeId }) => followeeId);
  }
}
