import { Check, Column, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';
import { MediaFileVariantEntity } from './media-file-variant.entity.js';

@Entity({ schema: 'media', name: 'files' })
@Index('files_owner_id_idx', ['ownerId'])
@Check('files_width_check', '"width" > 0')
@Check('files_height_check', '"height" > 0')
export class MediaFileEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'files_pkey' })
  id: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @Column({ type: 'integer' })
  width: number;

  @Column({ type: 'integer' })
  height: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @OneToMany(() => MediaFileVariantEntity, (variant) => variant.file, { cascade: ['insert'] })
  variants: MediaFileVariantEntity[];
}
