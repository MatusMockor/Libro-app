import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { EditionEntity } from './edition.entity.js';
import { WorkAuthorEntity } from './work-author.entity.js';

@Entity({ schema: 'books', name: 'works' })
export class WorkEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'works_pkey' })
  id: string;

  @Column({ type: 'text' })
  title: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => WorkAuthorEntity, (workAuthor) => workAuthor.work, { cascade: ['insert'] })
  workAuthors: WorkAuthorEntity[];

  @OneToMany(() => EditionEntity, (edition) => edition.work, { cascade: ['insert'] })
  editions: EditionEntity[];
}
