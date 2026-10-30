import { Check, Column, Entity, PrimaryColumn } from 'typeorm';
import type { LiveSessionSharing } from '../domain/live-session-sharing.js';

@Entity({ schema: 'reading', name: 'sharing_settings' })
@Check('sharing_settings_live_sessions_check', `"live_sessions" IN ('followers', 'nobody')`)
export class SharingSettingEntity {
  @PrimaryColumn({
    name: 'user_id',
    type: 'uuid',
    primaryKeyConstraintName: 'sharing_settings_pkey',
  })
  userId: string;

  @Column({ name: 'live_sessions', type: 'text' })
  liveSessions: LiveSessionSharing;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
