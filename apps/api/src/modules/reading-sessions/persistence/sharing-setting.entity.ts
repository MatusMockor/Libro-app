import { Check, Column, Entity, PrimaryColumn } from 'typeorm';
import type { LiveSessionSharing } from '../domain/live-session-sharing.js';
import type { ReadingActivityAudience } from '../domain/reading-privacy.js';

@Entity({ schema: 'reading', name: 'sharing_settings' })
@Check('sharing_settings_live_sessions_check', `"live_sessions" IN ('followers', 'nobody')`)
@Check('sharing_settings_reading_activity_check', `"reading_activity" IN ('followers', 'nobody')`)
export class SharingSettingEntity {
  @PrimaryColumn({
    name: 'user_id',
    type: 'uuid',
    primaryKeyConstraintName: 'sharing_settings_pkey',
  })
  userId: string;

  @Column({ name: 'live_sessions', type: 'text' })
  liveSessions: LiveSessionSharing;

  @Column({ name: 'reading_activity', type: 'text', default: 'followers' })
  readingActivity: ReadingActivityAudience;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
