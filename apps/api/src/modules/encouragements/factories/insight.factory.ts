import { setSeederFactory, type FactoryCallback } from 'typeorm-extension';
import { InsightEntity } from '../persistence/insight.entity.js';

export interface InsightFactoryMeta {
  readingId?: string;
  readerId?: string;
  authorId?: string;
  text?: string;
  createdAt?: Date;
}

const FIRST_SERIAL = 1;

const SYNTHETIC_ID_DIGITS = 12;

export function createInsightFactory(): FactoryCallback<InsightEntity, InsightFactoryMeta> {
  let serial = FIRST_SERIAL;

  return (meta) => sampleInsight(serial++, meta ?? {});
}

export default setSeederFactory(InsightEntity, createInsightFactory());

function sampleInsight(serial: number, meta: InsightFactoryMeta): InsightEntity {
  return Object.assign(new InsightEntity(), {
    readingId: syntheticId('9101', serial),
    readerId: syntheticId('9102', serial),
    authorId: syntheticId('9103', serial),
    text: `Sample insight ${String(serial)}`,
    ...meta,
  });
}

function syntheticId(group: string, serial: number): string {
  return `00000000-0000-4000-${group}-${String(serial).padStart(SYNTHETIC_ID_DIGITS, '0')}`;
}
