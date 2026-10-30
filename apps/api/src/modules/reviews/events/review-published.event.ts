import { defineDomainEvent, type DomainEventOf } from '../../../events/domain-event.js';

export interface ReviewPublishedPayload {
  readonly readingId: string;
  readonly userId: string;
  readonly workId: string;
}

export const ReviewPublished = defineDomainEvent<ReviewPublishedPayload>('ReviewPublished', 1);
export type ReviewPublished = DomainEventOf<typeof ReviewPublished>;
