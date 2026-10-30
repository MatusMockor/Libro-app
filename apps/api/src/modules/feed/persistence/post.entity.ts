import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'feed', name: 'posts' })
@Index('posts_created_at_id_idx', ['createdAt', 'id'])
@Index('posts_author_id_created_at_id_idx', ['authorId', 'createdAt', 'id'])
@Check('posts_text_check', 'char_length("text") BETWEEN 1 AND 2000')
@Check('posts_place_check', 'char_length("place") BETWEEN 1 AND 100')
export class PostEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'posts_pkey' })
  id: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ name: 'work_id', type: 'uuid', nullable: true })
  workId: string | null;

  @Column({ type: 'text', nullable: true })
  place: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
