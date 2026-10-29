import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { UserEntity } from './user.entity.js';

@Entity({ schema: 'auth', name: 'identities' })
@Unique('identities_provider_subject_key', ['provider', 'subject'])
@Unique('identities_user_id_provider_key', ['userId', 'provider'])
@Check('identities_provider_check', `"provider" IN ('google')`)
@Check('identities_subject_check', `char_length("subject") BETWEEN 1 AND 255`)
export class IdentityEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'identities_pkey' })
  id: string;

  @Column({ type: 'text' })
  provider: string;

  @Column({ type: 'text' })
  subject: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'identities_user_id_fkey' })
  user: Relation<UserEntity>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
