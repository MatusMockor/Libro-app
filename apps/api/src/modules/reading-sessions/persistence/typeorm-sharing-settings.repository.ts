import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SharingSettingsRepository } from '../application/sharing-settings-repository.js';
import type { LiveSessionSharing } from '../domain/live-session-sharing.js';
import { SharingSettingEntity } from './sharing-setting.entity.js';

const SELECT_LIVE_SESSIONS = `
  SELECT live_sessions AS "liveSessions" FROM reading.sharing_settings WHERE user_id = $1
`;

const UPSERT_LIVE_SESSIONS = `
  INSERT INTO reading.sharing_settings (user_id, live_sessions, updated_at)
  VALUES ($1, $2, clock_timestamp())
  ON CONFLICT (user_id)
  DO UPDATE SET live_sessions = excluded.live_sessions, updated_at = excluded.updated_at
  RETURNING live_sessions AS "liveSessions"
`;

interface LiveSessionsRow {
  readonly liveSessions: LiveSessionSharing;
}

@Injectable()
export class TypeOrmSharingSettingsRepository implements SharingSettingsRepository {
  constructor(
    @InjectRepository(SharingSettingEntity)
    private readonly settings: Repository<SharingSettingEntity>,
  ) {}

  async liveSessionsOf(userId: string): Promise<LiveSessionSharing | undefined> {
    const [row] = await this.settings.query<LiveSessionsRow[]>(SELECT_LIVE_SESSIONS, [userId]);

    return row?.liveSessions;
  }

  async saveLiveSessions(userId: string, sharing: LiveSessionSharing): Promise<LiveSessionSharing> {
    const [row] = await this.settings.query<[LiveSessionsRow]>(UPSERT_LIVE_SESSIONS, [
      userId,
      sharing,
    ]);

    return row.liveSessions;
  }
}
