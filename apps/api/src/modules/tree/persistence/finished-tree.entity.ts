import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'tree', name: 'finished_trees' })
@Index('finished_trees_user_id_idx', ['userId'])
@Check('finished_trees_tree_engine_version_check', '"tree_engine_version" > 0')
export class FinishedTreeEntity {
  @PrimaryColumn({
    name: 'reading_id',
    type: 'uuid',
    primaryKeyConstraintName: 'finished_trees_pkey',
  })
  readingId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'tree_engine_version', type: 'smallint' })
  treeEngineVersion: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
