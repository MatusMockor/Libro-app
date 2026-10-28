import { defineDomainEvent, type DomainEventOf } from '../../../events/domain-event.js';

export interface BookAddedToCataloguePayload {
  readonly workId: string;
  readonly editionIds: readonly string[];
}

export const BookAddedToCatalogue = defineDomainEvent<BookAddedToCataloguePayload>(
  'BookAddedToCatalogue',
  1,
);
export type BookAddedToCatalogue = DomainEventOf<typeof BookAddedToCatalogue>;
