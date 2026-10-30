import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'encouragements', name: 'insights' })
@Index('insights_reading_id_created_at_id_idx', ['readingId', 'createdAt', 'id'])
@Index('insights_author_id_reading_id_idx', ['authorId', 'readingId'])
@Index('insights_reader_id_idx', ['readerId'])
@Check('insights_text_check', 'char_length("text") BETWEEN 1 AND 300')
@Check('insights_not_own_check', '"author_id" <> "reader_id"')
export class InsightEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'insights_pkey' })
  id: string;

  @Column({ name: 'reading_id', type: 'uuid' })
  readingId: string;

  @Column({ name: 'reader_id', type: 'uuid' })
  readerId: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
