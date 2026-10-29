import { defineDomainEvent, type DomainEventOf } from '../../../events/domain-event.js';

export interface UserDeletedPayload {
  readonly userId: string;
}

export const UserDeleted = defineDomainEvent<UserDeletedPayload>('UserDeleted', 1);
export type UserDeleted = DomainEventOf<typeof UserDeleted>;
