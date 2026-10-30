import { setSeederFactory, type FactoryCallback } from 'typeorm-extension';
import { ReviewEntity } from '../persistence/review.entity.js';

export interface ReviewFactoryMeta {
  readingId?: string;
  userId?: string;
  workId?: string;
  rating?: number;
  text?: string | null;
  photoMediaId?: string | null;
  finishedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const FIRST_SERIAL = 1;

const SYNTHETIC_ID_DIGITS = 12;

const RATINGS = 5;

const SAMPLE_FINISHED_AT = new Date('2026-10-01T12:00:00.000Z');

export function createReviewFactory(): FactoryCallback<ReviewEntity, ReviewFactoryMeta> {
  let serial = FIRST_SERIAL;

  return (meta) => sampleReview(serial++, meta ?? {});
}

export default setSeederFactory(ReviewEntity, createReviewFactory());

function sampleReview(serial: number, meta: ReviewFactoryMeta): ReviewEntity {
  return Object.assign(new ReviewEntity(), {
    readingId: syntheticId('9001', serial),
    userId: syntheticId('9002', serial),
    workId: syntheticId('9003', serial),
    rating: (serial % RATINGS) + 1,
    text: `Sample review ${String(serial)}`,
    photoMediaId: null,
    finishedAt: SAMPLE_FINISHED_AT,
    ...meta,
  });
}

function syntheticId(group: string, serial: number): string {
  return `00000000-0000-4000-${group}-${String(serial).padStart(SYNTHETIC_ID_DIGITS, '0')}`;
}
