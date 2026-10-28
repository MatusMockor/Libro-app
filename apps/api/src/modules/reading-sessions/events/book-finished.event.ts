import { defineDomainEvent, type DomainEventOf } from '../../../events/domain-event.js';

export interface BookFinishedPayload {
  readonly readingId: string;
  readonly userId: string;
  readonly workId: string;
}

export const BookFinished = defineDomainEvent<BookFinishedPayload>('BookFinished', 1);
export type BookFinished = DomainEventOf<typeof BookFinished>;
