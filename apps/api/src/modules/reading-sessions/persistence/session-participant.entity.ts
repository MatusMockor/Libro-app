import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { ReadingSessionEntity } from './reading-session.entity.js';

@Entity({ schema: 'reading', name: 'session_participants' })
@Index('session_participants_host_session_id_idx', ['hostSessionId'])
@Check('session_participants_not_self_check', '"host_session_id" <> "participant_session_id"')
@Check('session_participants_left_at_check', '"left_at" >= "joined_at"')
@Check('session_participants_removed_at_check', '"removed_at" >= "joined_at"')
export class SessionParticipantEntity {
  @PrimaryColumn({
    name: 'participant_session_id',
    type: 'uuid',
    primaryKeyConstraintName: 'session_participants_pkey',
  })
  participantSessionId: string;

  @ManyToOne(() => ReadingSessionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'participant_session_id',
    foreignKeyConstraintName: 'session_participants_participant_session_id_fkey',
  })
  participantSession: Relation<ReadingSessionEntity>;

  @Column({ name: 'host_session_id', type: 'uuid' })
  hostSessionId: string;

  @ManyToOne(() => ReadingSessionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'host_session_id',
    foreignKeyConstraintName: 'session_participants_host_session_id_fkey',
  })
  hostSession: Relation<ReadingSessionEntity>;

  @Column({ name: 'joined_at', type: 'timestamptz', default: () => 'now()' })
  joinedAt: Date;

  @Column({ name: 'left_at', type: 'timestamptz', nullable: true })
  leftAt: Date | null;

  @Column({ name: 'removed_at', type: 'timestamptz', nullable: true })
  removedAt: Date | null;
}
