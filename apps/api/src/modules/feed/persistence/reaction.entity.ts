import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { REACTION_KEYS, type ReactionKey } from '../domain/reactions.js';
import { PostEntity } from './post.entity.js';

const REACTION_KEY_LIST = REACTION_KEYS.map((key) => `'${key}'`).join(', ');

@Entity({ schema: 'feed', name: 'reactions' })
@Unique('reactions_post_id_user_id_reaction_key', ['postId', 'userId', 'reaction'])
@Index('reactions_post_id_created_at_id_idx', ['postId', 'createdAt', 'id'])
@Check('reactions_reaction_check', `"reaction" IN (${REACTION_KEY_LIST})`)
export class ReactionEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'reactions_pkey' })
  id: string;

  @Column({ name: 'post_id', type: 'uuid' })
  postId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  reaction: ReactionKey;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @ManyToOne(() => PostEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id', foreignKeyConstraintName: 'reactions_post_id_fkey' })
  post: Relation<PostEntity>;
}
