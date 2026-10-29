import { setSeederFactory, type FactoryCallback } from 'typeorm-extension';
import { FollowEntity } from '../persistence/follow.entity.js';

export interface FollowFactoryMeta {
  followerId?: string;
  followeeId?: string;
  createdAt?: Date;
}

const FIRST_SERIAL = 1;

const SYNTHETIC_ID_DIGITS = 12;

export function createFollowFactory(): FactoryCallback<FollowEntity, FollowFactoryMeta> {
  let serial = FIRST_SERIAL;

  return (meta) => {
    const current = serial++;

    return Object.assign(new FollowEntity(), {
      followerId: syntheticId('8002', current),
      followeeId: syntheticId('8003', current),
      ...meta,
    });
  };
}

export default setSeederFactory(FollowEntity, createFollowFactory());

function syntheticId(group: string, serial: number): string {
  return `00000000-0000-4000-${group}-${String(serial).padStart(SYNTHETIC_ID_DIGITS, '0')}`;
}
