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
import type { MediaVariantName } from '../domain/media-variant.js';
import { MediaFileEntity } from './media-file.entity.js';

@Entity({ schema: 'media', name: 'file_variants' })
@Unique('file_variants_storage_key_key', ['storageKey'])
@Check('file_variants_name_check', `"name" IN ('small', 'medium', 'large')`)
@Check('file_variants_width_check', '"width" > 0')
@Check('file_variants_height_check', '"height" > 0')
@Check('file_variants_byte_size_check', '"byte_size" > 0')
export class MediaFileVariantEntity {
  @PrimaryColumn({ name: 'file_id', type: 'uuid', primaryKeyConstraintName: 'file_variants_pkey' })
  fileId: string;

  @PrimaryColumn({ type: 'text', primaryKeyConstraintName: 'file_variants_pkey' })
  name: MediaVariantName;

  @Column({ name: 'storage_key', type: 'text' })
  storageKey: string;

  @Column({ type: 'integer' })
  width: number;

  @Column({ type: 'integer' })
  height: number;

  @Column({ name: 'byte_size', type: 'integer' })
  byteSize: number;

  @ManyToOne(() => MediaFileEntity, (file) => file.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'file_id', foreignKeyConstraintName: 'file_variants_file_id_fkey' })
  file: Relation<MediaFileEntity>;
}
