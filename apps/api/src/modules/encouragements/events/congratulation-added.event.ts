import { defineDomainEvent, type DomainEventOf } from '../../../events/domain-event.js';

export interface CongratulationAddedPayload {
  readonly readingId: string;
  readonly readerId: string;
  readonly authorId: string;
}

export const CongratulationAdded = defineDomainEvent<CongratulationAddedPayload>(
  'CongratulationAdded',
  1,
);
export type CongratulationAdded = DomainEventOf<typeof CongratulationAdded>;
