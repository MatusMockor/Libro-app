import { setSeederFactory, type FactoryCallback } from 'typeorm-extension';
import type { ReadingActivityKind } from '../domain/activity.js';
import { ActivityEntity } from '../persistence/activity.entity.js';

export interface ActivityFactoryMeta {
  actorId?: string;
  kind?: ReadingActivityKind;
  readingId?: string;
  workId?: string;
  createdAt?: Date;
}

const FIRST_SERIAL = 1;

const SYNTHETIC_ID_DIGITS = 12;

export function createActivityFactory(): FactoryCallback<ActivityEntity, ActivityFactoryMeta> {
  let serial = FIRST_SERIAL;

  return (meta) => {
    const current = serial++;

    return Object.assign(new ActivityEntity(), {
      actorId: syntheticId('8106', current),
      kind: 'reading_started',
      readingId: syntheticId('8107', current),
      workId: syntheticId('8108', current),
      ...meta,
    });
  };
}

export default setSeederFactory(ActivityEntity, createActivityFactory());

function syntheticId(group: string, serial: number): string {
  return `00000000-0000-4000-${group}-${String(serial).padStart(SYNTHETIC_ID_DIGITS, '0')}`;
}
