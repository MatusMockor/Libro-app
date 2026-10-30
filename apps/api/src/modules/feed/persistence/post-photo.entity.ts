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
import { PostEntity } from './post.entity.js';

@Entity({ schema: 'feed', name: 'post_photos' })
@Unique('post_photos_post_id_media_id_key', ['postId', 'mediaId'])
@Check('post_photos_position_check', '"position" BETWEEN 1 AND 4')
export class PostPhotoEntity {
  @PrimaryColumn({ name: 'post_id', type: 'uuid', primaryKeyConstraintName: 'post_photos_pkey' })
  postId: string;

  @PrimaryColumn({ type: 'smallint', primaryKeyConstraintName: 'post_photos_pkey' })
  position: number;

  @Column({ name: 'media_id', type: 'uuid' })
  mediaId: string;

  @ManyToOne(() => PostEntity, (post) => post.photos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id', foreignKeyConstraintName: 'post_photos_post_id_fkey' })
  post: Relation<PostEntity>;
}
