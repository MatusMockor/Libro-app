import { setSeederFactory, type FactoryCallback } from 'typeorm-extension';
import type { Genre } from '../domain/genres.js';
import { ProfileEntity } from '../persistence/profile.entity.js';
import { TopBookEntity } from '../persistence/top-book.entity.js';

export interface ProfileFactoryMeta {
  userId?: string;
  handle?: string;
  displayName?: string | null;
  bio?: string | null;
  favouriteGenres?: readonly Genre[];
  avatarMediaId?: string | null;
  topBookIds?: readonly string[];
}

const FIRST_SERIAL = 1;

const SYNTHETIC_ID_DIGITS = 12;

export function createProfileFactory(): FactoryCallback<ProfileEntity, ProfileFactoryMeta> {
  let serial = FIRST_SERIAL;

  return (meta) => sampleProfile(serial++, meta ?? {});
}

export default setSeederFactory(ProfileEntity, createProfileFactory());

function sampleProfile(
  serial: number,
  { topBookIds = [], favouriteGenres = [], ...meta }: ProfileFactoryMeta,
): ProfileEntity {
  const userId = meta.userId ?? syntheticId(serial);

  return Object.assign(new ProfileEntity(), {
    userId,
    handle: `reader.${String(serial)}`,
    displayName: null,
    bio: null,
    avatarMediaId: null,
    ...meta,
    favouriteGenres: [...favouriteGenres],
    topBooks: topBookIds.map((workId, index) =>
      Object.assign(new TopBookEntity(), { userId, position: index + 1, workId }),
    ),
  });
}

function syntheticId(serial: number): string {
  return `00000000-0000-4000-8001-${String(serial).padStart(SYNTHETIC_ID_DIGITS, '0')}`;
}
