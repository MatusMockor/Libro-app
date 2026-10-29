import { Check, Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'media', name: 'pending_file_deletions' })
@Check('pending_file_deletions_attempts_check', '"attempts" >= 0')
export class PendingFileDeletionEntity {
  @PrimaryColumn({
    name: 'storage_key',
    type: 'text',
    primaryKeyConstraintName: 'pending_file_deletions_pkey',
  })
  storageKey: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;
}
