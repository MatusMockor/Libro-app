import { Injectable } from '@nestjs/common';
import { OnDomainEvent } from '../../../../src/events/on-domain-event.decorator.js';
import { ProbeBookFinished, ProbeBookFinishedV2 } from '../probe-book-finished.event.js';
import { ProbeEventRecorder } from './probe-event-recorder.js';
import { ProbeGate } from './probe-gate.js';

@Injectable()
export class ProbeShelfHandler {
  constructor(
    private readonly recorder: ProbeEventRecorder,
    private readonly gate: ProbeGate,
  ) {}

  @OnDomainEvent(ProbeBookFinished)
  async onBookFinished(event: ProbeBookFinished): Promise<void> {
    await this.gate.pass();
    this.recorder.record('shelf.v1', event);
  }

  @OnDomainEvent(ProbeBookFinishedV2)
  onBookFinishedV2(event: ProbeBookFinishedV2): void {
    this.recorder.record('shelf.v2', event);
  }
}
