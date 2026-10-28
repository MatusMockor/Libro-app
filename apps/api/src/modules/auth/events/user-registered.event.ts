import { defineDomainEvent, type DomainEventOf } from '../../../events/domain-event.js';

export interface UserRegisteredPayload {
  readonly userId: string;
}

export const UserRegistered = defineDomainEvent<UserRegisteredPayload>('UserRegistered', 1);
export type UserRegistered = DomainEventOf<typeof UserRegistered>;
