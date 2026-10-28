import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { AuthorEntity } from './author.entity.js';
import { WorkEntity } from './work.entity.js';

@Entity({ schema: 'books', name: 'work_authors' })
@Unique('work_authors_work_id_position_key', ['workId', 'position'])
@Check('work_authors_position_check', '"position" > 0')
@Index('work_authors_author_id_idx', ['authorId'])
export class WorkAuthorEntity {
  @PrimaryColumn({ name: 'work_id', type: 'uuid', primaryKeyConstraintName: 'work_authors_pkey' })
  workId: string;

  @PrimaryColumn({ name: 'author_id', type: 'uuid', primaryKeyConstraintName: 'work_authors_pkey' })
  authorId: string;

  @Column({ type: 'smallint' })
  position: number;

  @ManyToOne(() => WorkEntity, (work) => work.workAuthors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_id', foreignKeyConstraintName: 'work_authors_work_id_fkey' })
  work: Relation<WorkEntity>;

  @ManyToOne(() => AuthorEntity, { onDelete: 'RESTRICT', cascade: ['insert'] })
  @JoinColumn({ name: 'author_id', foreignKeyConstraintName: 'work_authors_author_id_fkey' })
  author: Relation<AuthorEntity>;
}
