import { Injectable } from '@nestjs/common';
import { OnDomainEvent } from '../../../../src/events/on-domain-event.decorator.js';
import { BookFinished, SessionEnded } from '../../../../src/modules/reading-sessions/index.js';
import { ProbeEventRecorder } from '../subscriber/probe-event-recorder.js';

@Injectable()
export class ProbeReadingSessionsHandler {
  constructor(private readonly recorder: ProbeEventRecorder) {}

  @OnDomainEvent(SessionEnded)
  onSessionEnded(event: SessionEnded): void {
    this.recorder.record('reading-sessions.v1', event);
  }

  @OnDomainEvent(BookFinished)
  onBookFinished(event: BookFinished): void {
    this.recorder.record('reading-sessions.v1', event);
  }
}
