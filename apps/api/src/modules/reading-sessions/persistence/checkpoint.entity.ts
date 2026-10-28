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
import { ReadingSessionEntity } from './reading-session.entity.js';

@Entity({ schema: 'reading', name: 'checkpoints' })
@Index('checkpoints_session_id_idx', ['sessionId'])
@Check('checkpoints_page_check', '"page" > 0')
export class CheckpointEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'checkpoints_pkey' })
  id: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @ManyToOne(() => ReadingSessionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id', foreignKeyConstraintName: 'checkpoints_session_id_fkey' })
  session: Relation<ReadingSessionEntity>;

  @Column({ type: 'integer' })
  page: number;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'now()' })
  recordedAt: Date;
}
