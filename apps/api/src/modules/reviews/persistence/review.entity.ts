import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'reviews', name: 'reviews' })
@Index('reviews_user_id_created_at_reading_id_idx', ['userId', 'createdAt', 'readingId'])
@Index('reviews_work_id_user_id_created_at_reading_id_idx', [
  'workId',
  'userId',
  'createdAt',
  'readingId',
])
@Check('reviews_rating_check', '"rating" BETWEEN 1 AND 5')
@Check('reviews_text_check', 'char_length("text") BETWEEN 1 AND 1000')
export class ReviewEntity {
  @PrimaryColumn({ name: 'reading_id', type: 'uuid', primaryKeyConstraintName: 'reviews_pkey' })
  readingId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'work_id', type: 'uuid' })
  workId: string;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  text: string | null;

  @Column({ name: 'photo_media_id', type: 'uuid', nullable: true })
  photoMediaId: string | null;

  @Column({ name: 'finished_at', type: 'timestamptz' })
  finishedAt: Date;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
