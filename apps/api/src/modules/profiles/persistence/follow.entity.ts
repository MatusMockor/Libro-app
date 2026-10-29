import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { ProfileEntity } from './profile.entity.js';

@Entity({ schema: 'profiles', name: 'follows' })
@Index('follows_followee_id_created_at_idx', ['followeeId', 'createdAt'])
@Check('follows_not_self_check', '"follower_id" <> "followee_id"')
export class FollowEntity {
  @PrimaryColumn({ name: 'follower_id', type: 'uuid', primaryKeyConstraintName: 'follows_pkey' })
  followerId: string;

  @PrimaryColumn({ name: 'followee_id', type: 'uuid', primaryKeyConstraintName: 'follows_pkey' })
  followeeId: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @ManyToOne(() => ProfileEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'follower_id', foreignKeyConstraintName: 'follows_follower_id_fkey' })
  follower: Relation<ProfileEntity>;

  @ManyToOne(() => ProfileEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'followee_id', foreignKeyConstraintName: 'follows_followee_id_fkey' })
  followee: Relation<ProfileEntity>;
}
