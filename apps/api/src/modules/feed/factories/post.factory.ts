import { setSeederFactory, type FactoryCallback } from 'typeorm-extension';
import { PostEntity } from '../persistence/post.entity.js';

export interface PostFactoryMeta {
  id?: string;
  authorId?: string;
  text?: string;
  workId?: string | null;
  place?: string | null;
  createdAt?: Date;
}

const FIRST_SERIAL = 1;

const SYNTHETIC_ID_DIGITS = 12;

export function createPostFactory(): FactoryCallback<PostEntity, PostFactoryMeta> {
  let serial = FIRST_SERIAL;

  return (meta) => {
    const current = serial++;

    return Object.assign(new PostEntity(), {
      authorId: syntheticId(current),
      text: `Sample post ${String(current)}`,
      workId: null,
      place: null,
      ...meta,
    });
  };
}

export default setSeederFactory(PostEntity, createPostFactory());

function syntheticId(serial: number): string {
  return `00000000-0000-4000-8101-${String(serial).padStart(SYNTHETIC_ID_DIGITS, '0')}`;
}
