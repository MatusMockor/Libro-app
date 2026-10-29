import { Check, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'auth', name: 'sign_in_nonces' })
@Check('sign_in_nonces_nonce_hash_check', `"nonce_hash" ~ '^[0-9a-f]{64}$'`)
@Check('sign_in_nonces_provider_check', `"provider" IN ('google')`)
@Index('sign_in_nonces_expires_at_idx', ['expiresAt'])
export class SignInNonceEntity {
  @PrimaryColumn({
    name: 'nonce_hash',
    type: 'char',
    length: 64,
    primaryKeyConstraintName: 'sign_in_nonces_pkey',
  })
  nonceHash: string;

  @Column({ type: 'text' })
  provider: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
