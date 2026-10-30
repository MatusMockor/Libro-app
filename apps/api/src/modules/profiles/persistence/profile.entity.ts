import { Check, Column, Entity, Index, OneToMany, PrimaryColumn, Unique } from 'typeorm';
import { TopBookEntity } from './top-book.entity.js';

export const PROFILES_HANDLE_KEY = 'profiles_handle_key';

@Entity({ schema: 'profiles', name: 'profiles' })
@Unique(PROFILES_HANDLE_KEY, ['handle'])
@Index('profiles_official_idx', ['userId'], { where: '"official"' })
@Check(
  'profiles_handle_check',
  `char_length("handle") BETWEEN 3 AND 30 AND "handle" ~ '^[a-z0-9]+([._][a-z0-9]+)*$'`,
)
@Check('profiles_display_name_check', 'char_length("display_name") BETWEEN 1 AND 50')
@Check('profiles_bio_check', 'char_length("bio") BETWEEN 1 AND 300')
@Check('profiles_favourite_genres_check', 'cardinality("favourite_genres") <= 10')
export class ProfileEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid', primaryKeyConstraintName: 'profiles_pkey' })
  userId: string;

  @Column({ type: 'text' })
  handle: string;

  @Column({ name: 'display_name', type: 'text', nullable: true })
  displayName: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ name: 'favourite_genres', type: 'text', array: true, default: () => "'{}'" })
  favouriteGenres: string[];

  @Column({ name: 'avatar_media_id', type: 'uuid', nullable: true })
  avatarMediaId: string | null;

  @Column({ type: 'boolean', default: false })
  official: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @OneToMany(() => TopBookEntity, (topBook) => topBook.profile, { cascade: ['insert'] })
  topBooks: TopBookEntity[];
}
