import { Injectable } from '@nestjs/common';
import type { DomainEvent } from '../../../../src/events/domain-event.js';

export interface ReceivedEvent {
  readonly handler: string;
  readonly event: DomainEvent;
}

@Injectable()
export class ProbeEventRecorder {
  private received: ReceivedEvent[] = [];

  record(handler: string, event: DomainEvent): void {
    this.received.push({ handler, event });
  }

  all(): readonly ReceivedEvent[] {
    return this.received;
  }

  clear(): void {
    this.received = [];
  }
}
