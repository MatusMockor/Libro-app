import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'books', name: 'authors' })
export class AuthorEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'authors_pkey' })
  id: string;

  @Column({ type: 'text' })
  name: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
