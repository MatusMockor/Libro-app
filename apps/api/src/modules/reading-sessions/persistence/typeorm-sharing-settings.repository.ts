import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SharingSettingsRepository } from '../application/sharing-settings-repository.js';
import {
  DEFAULT_READING_PRIVACY,
  READING_ACTIVITY_SHARED_WITH_FOLLOWERS,
  type ReadingPrivacy,
  type ReadingPrivacyChanges,
} from '../domain/reading-privacy.js';
import { SharingSettingEntity } from './sharing-setting.entity.js';

const PRIVACY_COLUMNS = `
  live_sessions AS "liveSessions", reading_activity AS "readingActivity"
`;

const SELECT_PRIVACY = `
  SELECT ${PRIVACY_COLUMNS} FROM reading.sharing_settings WHERE user_id = $1
`;

const UPSERT_PRIVACY = `
  INSERT INTO reading.sharing_settings (user_id, live_sessions, reading_activity, updated_at)
  VALUES ($1, coalesce($2::text, $4::text), coalesce($3::text, $5::text), clock_timestamp())
  ON CONFLICT (user_id)
  DO UPDATE SET live_sessions = coalesce($2::text, sharing_settings.live_sessions),
                reading_activity = coalesce($3::text, sharing_settings.reading_activity),
                updated_at = excluded.updated_at
  RETURNING ${PRIVACY_COLUMNS}
`;

const SELECT_SHARING_READING_ACTIVITY = `
  SELECT candidate.user_id::text AS "userId"
  FROM unnest($1::uuid[]) AS candidate (user_id)
  LEFT JOIN reading.sharing_settings AS setting ON setting.user_id = candidate.user_id
  WHERE coalesce(setting.reading_activity, $2) = $2
`;

@Injectable()
export class TypeOrmSharingSettingsRepository implements SharingSettingsRepository {
  constructor(
    @InjectRepository(SharingSettingEntity)
    private readonly settings: Repository<SharingSettingEntity>,
  ) {}

  async privacyOf(userId: string): Promise<ReadingPrivacy | undefined> {
    const [row] = await this.settings.query<ReadingPrivacy[]>(SELECT_PRIVACY, [userId]);

    return row;
  }

  async savePrivacy(
    userId: string,
    { liveSessions, readingActivity }: ReadingPrivacyChanges,
  ): Promise<ReadingPrivacy> {
    const [row] = await this.settings.query<[ReadingPrivacy]>(UPSERT_PRIVACY, [
      userId,
      liveSessions ?? null,
      readingActivity ?? null,
      DEFAULT_READING_PRIVACY.liveSessions,
      DEFAULT_READING_PRIVACY.readingActivity,
    ]);

    return row;
  }

  async sharingReadingActivity(userIds: readonly string[]): Promise<string[]> {
    const rows = await this.settings.query<{ userId: string }[]>(SELECT_SHARING_READING_ACTIVITY, [
      userIds,
      READING_ACTIVITY_SHARED_WITH_FOLLOWERS,
    ]);

    return rows.map(({ userId }) => userId);
  }
}
