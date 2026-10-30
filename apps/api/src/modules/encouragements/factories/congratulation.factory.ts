import { setSeederFactory, type FactoryCallback } from 'typeorm-extension';
import { CongratulationEntity } from '../persistence/congratulation.entity.js';

export interface CongratulationFactoryMeta {
  readingId?: string;
  readerId?: string;
  authorId?: string;
  createdAt?: Date;
}

const FIRST_SERIAL = 1;

const SYNTHETIC_ID_DIGITS = 12;

export function createCongratulationFactory(): FactoryCallback<
  CongratulationEntity,
  CongratulationFactoryMeta
> {
  let serial = FIRST_SERIAL;

  return (meta) => sampleCongratulation(serial++, meta ?? {});
}

export default setSeederFactory(CongratulationEntity, createCongratulationFactory());

function sampleCongratulation(
  serial: number,
  meta: CongratulationFactoryMeta,
): CongratulationEntity {
  return Object.assign(new CongratulationEntity(), {
    readingId: syntheticId('9201', serial),
    readerId: syntheticId('9202', serial),
    authorId: syntheticId('9203', serial),
    ...meta,
  });
}

function syntheticId(group: string, serial: number): string {
  return `00000000-0000-4000-${group}-${String(serial).padStart(SYNTHETIC_ID_DIGITS, '0')}`;
}
