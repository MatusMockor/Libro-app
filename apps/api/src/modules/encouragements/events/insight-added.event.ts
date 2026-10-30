import { defineDomainEvent, type DomainEventOf } from '../../../events/domain-event.js';

export interface InsightAddedPayload {
  readonly insightId: string;
  readonly readingId: string;
  readonly readerId: string;
  readonly authorId: string;
}

export const InsightAdded = defineDomainEvent<InsightAddedPayload>('InsightAdded', 1);
export type InsightAdded = DomainEventOf<typeof InsightAdded>;
