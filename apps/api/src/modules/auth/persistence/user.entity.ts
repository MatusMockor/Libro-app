import { Check, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

export const USERS_EMAIL_KEY = 'users_email_key';

@Entity({ schema: 'auth', name: 'users' })
@Unique(USERS_EMAIL_KEY, ['email'])
@Check('users_email_check', `"email" = lower("email")`)
export class UserEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'users_pkey' })
  id: string;

  @Column({ type: 'text' })
  email: string;

  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
