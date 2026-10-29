import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'auth', name: 'deleted_accounts' })
@Index('deleted_accounts_deleted_at_idx', ['deletedAt'])
export class DeletedAccountEntity {
  @PrimaryColumn({
    name: 'user_id',
    type: 'uuid',
    primaryKeyConstraintName: 'deleted_accounts_pkey',
  })
  userId: string;

  @Column({ name: 'deleted_at', type: 'timestamptz', default: () => 'now()' })
  deletedAt: Date;
}
