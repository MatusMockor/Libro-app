import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'encouragements', name: 'congratulations' })
@Index('congratulations_reading_id_created_at_author_id_idx', [
  'readingId',
  'createdAt',
  'authorId',
])
@Index('congratulations_author_id_idx', ['authorId'])
@Index('congratulations_reader_id_idx', ['readerId'])
@Check('congratulations_not_own_check', '"author_id" <> "reader_id"')
export class CongratulationEntity {
  @PrimaryColumn({
    name: 'reading_id',
    type: 'uuid',
    primaryKeyConstraintName: 'congratulations_pkey',
  })
  readingId: string;

  @PrimaryColumn({
    name: 'author_id',
    type: 'uuid',
    primaryKeyConstraintName: 'congratulations_pkey',
  })
  authorId: string;

  @Column({ name: 'reader_id', type: 'uuid' })
  readerId: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
