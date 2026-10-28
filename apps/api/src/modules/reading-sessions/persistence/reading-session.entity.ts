import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import type { SessionStatus } from '../domain/reading-session.js';
import { ReadingEntity } from './reading.entity.js';

export const SESSIONS_OPEN_USER_ID_KEY = 'sessions_open_user_id_key';

@Entity({ schema: 'reading', name: 'sessions' })
@Index(SESSIONS_OPEN_USER_ID_KEY, ['userId'], { unique: true, where: `"status" <> 'ended'` })
@Index('sessions_reading_id_idx', ['readingId'])
@Check('sessions_status_check', `"status" IN ('active', 'paused', 'ended')`)
@Check('sessions_place_check', `char_length("place") BETWEEN 1 AND 100`)
@Check('sessions_active_seconds_check', '"active_seconds" >= 0')
@Check('sessions_active_since_check', `("status" = 'active') = ("active_since" IS NOT NULL)`)
@Check('sessions_ended_at_check', `("status" = 'ended') = ("ended_at" IS NOT NULL)`)
export class ReadingSessionEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'sessions_pkey' })
  id: string;

  @Column({ name: 'reading_id', type: 'uuid' })
  readingId: string;

  @ManyToOne(() => ReadingEntity, { onDelete: 'CASCADE', cascade: ['insert'] })
  @JoinColumn({ name: 'reading_id', foreignKeyConstraintName: 'sessions_reading_id_fkey' })
  reading: Relation<ReadingEntity>;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'text', nullable: true })
  place: string | null;

  @Column({ type: 'text' })
  status: SessionStatus;

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'now()' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @Column({ name: 'active_seconds', type: 'double precision', default: 0 })
  activeSeconds: number;

  @Column({ name: 'active_since', type: 'timestamptz', nullable: true })
  activeSince: Date | null;
}
