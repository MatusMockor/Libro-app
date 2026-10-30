import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { PostEntity } from './post.entity.js';

@Entity({ schema: 'feed', name: 'likes' })
@Index('likes_user_id_idx', ['userId'])
export class LikeEntity {
  @PrimaryColumn({ name: 'post_id', type: 'uuid', primaryKeyConstraintName: 'likes_pkey' })
  postId: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid', primaryKeyConstraintName: 'likes_pkey' })
  userId: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @ManyToOne(() => PostEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id', foreignKeyConstraintName: 'likes_post_id_fkey' })
  post: Relation<PostEntity>;
}
