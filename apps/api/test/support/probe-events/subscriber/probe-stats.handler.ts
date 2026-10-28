import { Injectable } from '@nestjs/common';
import { OnDomainEvent } from '../../../../src/events/on-domain-event.decorator.js';
import { ProbeBookFinished } from '../probe-book-finished.event.js';
import { ProbeEventRecorder } from './probe-event-recorder.js';

@Injectable()
export class ProbeStatsHandler {
  constructor(private readonly recorder: ProbeEventRecorder) {}

  @OnDomainEvent(ProbeBookFinished)
  onBookFinished(event: ProbeBookFinished): void {
    this.recorder.record('stats.v1', event);
  }
}
