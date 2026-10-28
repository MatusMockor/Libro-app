import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { RefreshTokenEntity } from './refresh-token.entity.js';
import { UserEntity } from './user.entity.js';

@Entity({ schema: 'auth', name: 'sessions' })
@Index('sessions_user_id_idx', ['userId'])
export class SessionEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'sessions_pkey' })
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'sessions_user_id_fkey' })
  user: Relation<UserEntity>;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => RefreshTokenEntity, (token) => token.session, { cascade: ['insert'] })
  refreshTokens: RefreshTokenEntity[];
}
