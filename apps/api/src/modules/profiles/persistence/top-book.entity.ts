import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { ProfileEntity } from './profile.entity.js';

@Entity({ schema: 'profiles', name: 'top_books' })
@Unique('top_books_user_id_work_id_key', ['userId', 'workId'])
@Check('top_books_position_check', '"position" BETWEEN 1 AND 3')
export class TopBookEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid', primaryKeyConstraintName: 'top_books_pkey' })
  userId: string;

  @PrimaryColumn({ type: 'smallint', primaryKeyConstraintName: 'top_books_pkey' })
  position: number;

  @Column({ name: 'work_id', type: 'uuid' })
  workId: string;

  @ManyToOne(() => ProfileEntity, (profile) => profile.topBooks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'top_books_user_id_fkey' })
  profile: Relation<ProfileEntity>;
}
