import { setSeederFactory, type FactoryCallback } from 'typeorm-extension';
import { ReadingEntity } from '../persistence/reading.entity.js';

export interface ReadingFactoryMeta {
  userId?: string;
  workId?: string;
  startedAt?: Date;
  finishedAt?: Date | null;
}

const FIRST_SERIAL = 1;

const SYNTHETIC_ID_DIGITS = 12;

export function createReadingFactory(): FactoryCallback<ReadingEntity, ReadingFactoryMeta> {
  let serial = FIRST_SERIAL;

  return (meta) => sampleReading(serial++, meta);
}

export function sampleReading(serial: number, meta: ReadingFactoryMeta = {}): ReadingEntity {
  return Object.assign(new ReadingEntity(), {
    userId: syntheticId('a', serial),
    workId: syntheticId('b', serial),
    finishedAt: null,
    ...meta,
  });
}

export default setSeederFactory(ReadingEntity, createReadingFactory());

function syntheticId(variant: string, serial: number): string {
  return `00000000-0000-4000-${variant}000-${String(serial).padStart(SYNTHETIC_ID_DIGITS, '0')}`;
}
