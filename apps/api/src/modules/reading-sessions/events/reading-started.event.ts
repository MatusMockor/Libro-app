import { defineDomainEvent, type DomainEventOf } from '../../../events/domain-event.js';

export interface ReadingStartedPayload {
  readonly readingId: string;
  readonly userId: string;
  readonly workId: string;
}

export const ReadingStarted = defineDomainEvent<ReadingStartedPayload>('ReadingStarted', 1);
export type ReadingStarted = DomainEventOf<typeof ReadingStarted>;
