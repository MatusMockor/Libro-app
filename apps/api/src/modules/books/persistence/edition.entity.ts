import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { WorkEntity } from './work.entity.js';

export const EDITIONS_ISBN13_KEY = 'editions_isbn13_key';

@Entity({ schema: 'books', name: 'editions' })
@Unique(EDITIONS_ISBN13_KEY, ['isbn13'])
@Check('editions_isbn13_check', `"isbn13" ~ '^[0-9]{13}$'`)
@Check('editions_language_check', `"language" ~ '^[a-z]{2}$'`)
@Index('editions_work_id_idx', ['work'])
export class EditionEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'editions_pkey' })
  id: string;

  @ManyToOne(() => WorkEntity, (work) => work.editions, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_id', foreignKeyConstraintName: 'editions_work_id_fkey' })
  work: Relation<WorkEntity>;

  @Column({ type: 'char', length: 13, nullable: true })
  isbn13: string | null;

  @Column({ type: 'text' })
  language: string;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ name: 'published_year', type: 'smallint', nullable: true })
  publishedYear: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
