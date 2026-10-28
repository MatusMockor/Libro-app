import { setSeederFactory, type FactoryCallback } from 'typeorm-extension';
import type { NewMarkedPart, SessionStatus } from '../domain/reading-session.js';
import { CheckpointEntity } from '../persistence/checkpoint.entity.js';
import { MarkedPartEntity } from '../persistence/marked-part.entity.js';
import { ReadingSessionEntity } from '../persistence/reading-session.entity.js';
import type { ReadingEntity } from '../persistence/reading.entity.js';
import { sampleReading } from './reading.factory.js';

export interface ReadingSessionFactoryMeta {
  reading?: ReadingEntity;
  status?: SessionStatus;
  place?: string | null;
  startedAt?: Date;
  activeSeconds?: number;
  activeSince?: Date | null;
  checkpointPages?: readonly number[];
  markedParts?: readonly NewMarkedPart[];
}

const FIRST_SERIAL = 1_000_001;

const CHILD_SPACING_MS = 1000;

function childTime(startedAt: Date, index: number): Date {
  return new Date(startedAt.getTime() + (index + 1) * CHILD_SPACING_MS);
}

export function createReadingSessionFactory(): FactoryCallback<
  ReadingSessionEntity,
  ReadingSessionFactoryMeta
> {
  let serial = FIRST_SERIAL;

  return (meta = {}) => {
    const reading = meta.reading ?? sampleReading(serial);
    const status = meta.status ?? 'active';
    const startedAt = meta.startedAt ?? new Date();
    serial += 1;

    return Object.assign(new ReadingSessionEntity(), {
      reading,
      userId: reading.userId,
      place: meta.place ?? null,
      status,
      startedAt,
      endedAt: status === 'ended' ? new Date() : null,
      activeSeconds: meta.activeSeconds ?? 0,
      activeSince: meta.activeSince ?? (status === 'active' ? startedAt : null),
      checkpoints: (meta.checkpointPages ?? []).map((page, index) =>
        Object.assign(new CheckpointEntity(), { page, recordedAt: childTime(startedAt, index) }),
      ),
      markedParts: (meta.markedParts ?? []).map((part, index) =>
        Object.assign(new MarkedPartEntity(), { ...part, createdAt: childTime(startedAt, index) }),
      ),
    });
  };
}

export default setSeederFactory(ReadingSessionEntity, createReadingSessionFactory());
