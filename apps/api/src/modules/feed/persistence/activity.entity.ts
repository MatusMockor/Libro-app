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
import { ACTIVITY_KINDS, POST_ACTIVITY, type ActivityKind } from '../domain/activity.js';
import { PostEntity } from './post.entity.js';

const ACTIVITY_KIND_LIST = ACTIVITY_KINDS.map((kind) => `'${kind}'`).join(', ');

@Entity({ schema: 'feed', name: 'activities' })
@Unique('activities_post_id_key', ['postId'])
@Unique('activities_kind_reading_id_key', ['kind', 'readingId'])
@Index('activities_actor_id_created_at_id_idx', ['actorId', 'createdAt', 'id'])
@Index('activities_posts_created_at_id_idx', ['createdAt', 'id'], {
  where: `"kind" = '${POST_ACTIVITY}'`,
})
@Check('activities_kind_check', `"kind" IN (${ACTIVITY_KIND_LIST})`)
@Check(
  'activities_shape_check',
  `("kind" = '${POST_ACTIVITY}' AND "post_id" IS NOT NULL AND "reading_id" IS NULL AND "work_id" IS NULL) OR ("kind" <> '${POST_ACTIVITY}' AND "post_id" IS NULL AND "reading_id" IS NOT NULL AND "work_id" IS NOT NULL)`,
)
export class ActivityEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'activities_pkey' })
  id: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column({ type: 'text' })
  kind: ActivityKind;

  @Column({ name: 'post_id', type: 'uuid', nullable: true })
  postId: string | null;

  @Column({ name: 'reading_id', type: 'uuid', nullable: true })
  readingId: string | null;

  @Column({ name: 'work_id', type: 'uuid', nullable: true })
  workId: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @ManyToOne(() => PostEntity, (post) => post.activities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id', foreignKeyConstraintName: 'activities_post_id_fkey' })
  post: Relation<PostEntity> | null;
}
