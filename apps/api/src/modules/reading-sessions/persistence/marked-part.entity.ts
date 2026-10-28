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
import type { MarkedPartKind } from '../domain/reading-session.js';
import { ReadingSessionEntity } from './reading-session.entity.js';

@Entity({ schema: 'reading', name: 'marked_parts' })
@Index('marked_parts_session_id_idx', ['sessionId'])
@Check('marked_parts_kind_check', `"kind" IN ('good', 'slow', 'skipped')`)
@Check('marked_parts_from_page_check', '"from_page" > 0')
@Check('marked_parts_to_page_check', '"to_page" >= "from_page"')
export class MarkedPartEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'marked_parts_pkey' })
  id: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @ManyToOne(() => ReadingSessionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id', foreignKeyConstraintName: 'marked_parts_session_id_fkey' })
  session: Relation<ReadingSessionEntity>;

  @Column({ type: 'text' })
  kind: MarkedPartKind;

  @Column({ name: 'from_page', type: 'integer' })
  fromPage: number;

  @Column({ name: 'to_page', type: 'integer' })
  toPage: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
