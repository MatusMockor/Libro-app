import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'reading', name: 'readings' })
@Index('readings_unfinished_user_id_work_id_key', ['userId', 'workId'], {
  unique: true,
  where: '"finished_at" IS NULL',
})
@Index('readings_user_id_idx', ['userId'])
@Check('readings_finished_at_check', '"finished_at" >= "started_at"')
export class ReadingEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'readings_pkey' })
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'work_id', type: 'uuid' })
  workId: string;

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'now()' })
  startedAt: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;
}
