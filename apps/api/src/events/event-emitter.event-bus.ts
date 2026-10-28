import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { domainEventKey, type DomainEvent } from './domain-event.js';
import type { EventBus } from './event-bus.js';

@Injectable()
export class EventEmitterEventBus implements EventBus {
  constructor(private readonly emitter: EventEmitter2) {}

  async publish(event: DomainEvent): Promise<void> {
    await this.emitter.emitAsync(domainEventKey(event), event);
  }
}
