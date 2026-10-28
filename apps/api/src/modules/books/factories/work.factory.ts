import { setSeederFactory, type FactoryCallback } from 'typeorm-extension';
import type { NewWork } from '../domain/work.js';
import { WorkEntity } from '../persistence/work.entity.js';
import { toWorkEntity } from '../persistence/work.mapper.js';
import { syntheticIsbn13 } from './synthetic-isbn13.js';

export type WorkFactoryMeta = Partial<NewWork>;

const FIRST_SERIAL = 1_000_001;

export function createWorkFactory(): FactoryCallback<WorkEntity, WorkFactoryMeta> {
  let serial = FIRST_SERIAL;

  return (overrides) => toWorkEntity({ ...sampleWork(serial++), ...overrides });
}

export default setSeederFactory(WorkEntity, createWorkFactory());

function sampleWork(serial: number): NewWork {
  return {
    title: `Sample work ${String(serial)}`,
    authors: [`Sample author ${String(serial)}`],
    editions: [
      { isbn13: syntheticIsbn13(serial), language: 'sk', title: null, publishedYear: 2020 },
    ],
  };
}
