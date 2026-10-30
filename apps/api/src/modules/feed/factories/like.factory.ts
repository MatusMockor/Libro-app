import { setSeederFactory, type FactoryCallback } from 'typeorm-extension';
import { LikeEntity } from '../persistence/like.entity.js';

export interface LikeFactoryMeta {
  postId?: string;
  userId?: string;
  createdAt?: Date;
}

const FIRST_SERIAL = 1;

const SYNTHETIC_ID_DIGITS = 12;

export function createLikeFactory(): FactoryCallback<LikeEntity, LikeFactoryMeta> {
  let serial = FIRST_SERIAL;

  return (meta) => {
    const current = serial++;

    return Object.assign(new LikeEntity(), {
      postId: syntheticId('8102', current),
      userId: syntheticId('8103', current),
      ...meta,
    });
  };
}

export default setSeederFactory(LikeEntity, createLikeFactory());

function syntheticId(group: string, serial: number): string {
  return `00000000-0000-4000-${group}-${String(serial).padStart(SYNTHETIC_ID_DIGITS, '0')}`;
}
