import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { OfficialAccountRepository } from '../application/official-account-repository.js';
import type { OfficialAccountChange } from '../domain/official-account.js';
import { ProfileEntity } from './profile.entity.js';

const LOCK_OFFICIAL_ACCOUNTS = `
  SELECT pg_advisory_xact_lock(hashtextextended('profiles.official', 0))
`;

const LOCK_PROFILE_BY_HANDLE = `
  SELECT user_id AS "userId", official FROM profiles.profiles WHERE handle = $1 FOR UPDATE
`;

const COUNT_OFFICIAL = `
  SELECT count(*)::int AS count FROM profiles.profiles WHERE official
`;

const UPDATE_OFFICIAL = `
  UPDATE profiles.profiles SET official = $2, updated_at = now() WHERE user_id = $1
`;

const SELECT_OFFICIAL_USER_IDS = `
  SELECT user_id::text AS "userId" FROM profiles.profiles WHERE official ORDER BY user_id LIMIT $1
`;

interface LockedProfile {
  readonly userId: string;
  readonly official: boolean;
}

@Injectable()
export class TypeOrmOfficialAccountRepository implements OfficialAccountRepository {
  constructor(
    @InjectRepository(ProfileEntity) private readonly profiles: Repository<ProfileEntity>,
  ) {}

  setOfficial(handle: string, official: boolean, limit: number): Promise<OfficialAccountChange> {
    return this.profiles.manager.transaction(async (manager) => {
      await manager.query(LOCK_OFFICIAL_ACCOUNTS);
      const [profile] = await manager.query<LockedProfile[]>(LOCK_PROFILE_BY_HANDLE, [handle]);
      if (!profile) {
        return 'profile_not_found';
      }

      if (profile.official === official) {
        return 'unchanged';
      }

      const [{ count }] = await manager.query<[{ count: number }]>(COUNT_OFFICIAL);
      if (official && count >= limit) {
        return 'limit_reached';
      }

      await manager.query(UPDATE_OFFICIAL, [profile.userId, official]);

      return 'changed';
    });
  }

  async officialUserIds(limit: number): Promise<string[]> {
    const rows = await this.profiles.query<{ userId: string }[]>(SELECT_OFFICIAL_USER_IDS, [limit]);

    return rows.map(({ userId }) => userId);
  }
}
