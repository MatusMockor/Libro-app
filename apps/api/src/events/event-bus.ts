import type { DomainEvent } from './domain-event.js';

export const EVENT_BUS = Symbol('EVENT_BUS');

export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
}
