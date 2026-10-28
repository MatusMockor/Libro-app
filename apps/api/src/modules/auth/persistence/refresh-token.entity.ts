import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { SessionEntity } from './session.entity.js';

@Entity({ schema: 'auth', name: 'refresh_tokens' })
@Unique('refresh_tokens_token_hash_key', ['tokenHash'])
@Check('refresh_tokens_token_hash_check', `"token_hash" ~ '^[0-9a-f]{64}$'`)
@Index('refresh_tokens_session_id_idx', ['session'])
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'refresh_tokens_pkey' })
  id: string;

  @ManyToOne(() => SessionEntity, (session) => session.refreshTokens, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id', foreignKeyConstraintName: 'refresh_tokens_session_id_fkey' })
  session: Relation<SessionEntity>;

  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash: string;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
