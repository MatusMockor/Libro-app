import { setSeederFactory, type FactoryCallback } from 'typeorm-extension';
import { SessionParticipantEntity } from '../persistence/session-participant.entity.js';

export interface SessionParticipantFactoryMeta {
  hostSessionId?: string;
  participantSessionId?: string;
  joinedAt?: Date;
  leftAt?: Date | null;
  removedAt?: Date | null;
}

const FIRST_SERIAL = 1;

const SYNTHETIC_ID_DIGITS = 12;

export function createSessionParticipantFactory(): FactoryCallback<
  SessionParticipantEntity,
  SessionParticipantFactoryMeta
> {
  let serial = FIRST_SERIAL;

  return (meta = {}) => {
    const current = serial++;

    return Object.assign(new SessionParticipantEntity(), {
      hostSessionId: syntheticId('c', current),
      participantSessionId: syntheticId('d', current),
      leftAt: null,
      removedAt: null,
      ...meta,
    });
  };
}

export default setSeederFactory(SessionParticipantEntity, createSessionParticipantFactory());

function syntheticId(variant: string, serial: number): string {
  return `00000000-0000-4000-${variant}000-${String(serial).padStart(SYNTHETIC_ID_DIGITS, '0')}`;
}
