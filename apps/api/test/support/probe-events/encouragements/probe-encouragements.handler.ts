import { Injectable } from '@nestjs/common';
import { OnDomainEvent } from '../../../../src/events/on-domain-event.decorator.js';
import { CongratulationAdded, InsightAdded } from '../../../../src/modules/encouragements/index.js';
import { ProbeEventRecorder } from '../subscriber/probe-event-recorder.js';

@Injectable()
export class ProbeEncouragementsHandler {
  constructor(private readonly recorder: ProbeEventRecorder) {}

  @OnDomainEvent(InsightAdded)
  onInsightAdded(event: InsightAdded): void {
    this.recorder.record('encouragements.v1', event);
  }

  @OnDomainEvent(CongratulationAdded)
  onCongratulationAdded(event: CongratulationAdded): void {
    this.recorder.record('encouragements.v1', event);
  }
}
