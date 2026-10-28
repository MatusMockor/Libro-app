import { defineDomainEvent, type DomainEventOf } from '../../../src/events/domain-event.js';

export interface ProbeBookFinishedPayload {
  readonly bookId: string;
  readonly readerId: string;
}

export interface ProbeBookFinishedV2Payload extends ProbeBookFinishedPayload {
  readonly pages: number;
}

export const ProbeBookFinished = defineDomainEvent<ProbeBookFinishedPayload>(
  'ProbeBookFinished',
  1,
);
export type ProbeBookFinished = DomainEventOf<typeof ProbeBookFinished>;

export const ProbeBookFinishedV2 = defineDomainEvent<ProbeBookFinishedV2Payload>(
  'ProbeBookFinished',
  2,
);
export type ProbeBookFinishedV2 = DomainEventOf<typeof ProbeBookFinishedV2>;
