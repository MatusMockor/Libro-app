import { defineDomainEvent, type DomainEventOf } from '../../../events/domain-event.js';

export interface SessionEndedPayload {
  readonly sessionId: string;
  readonly readingId: string;
  readonly userId: string;
  readonly workId: string;
}

export const SessionEnded = defineDomainEvent<SessionEndedPayload>('SessionEnded', 1);
export type SessionEnded = DomainEventOf<typeof SessionEnded>;
