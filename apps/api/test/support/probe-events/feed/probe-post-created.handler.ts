import { Injectable } from '@nestjs/common';
import { OnDomainEvent } from '../../../../src/events/on-domain-event.decorator.js';
import { PostCreated } from '../../../../src/modules/feed/index.js';
import { ProbeEventRecorder } from '../subscriber/probe-event-recorder.js';

@Injectable()
export class ProbePostCreatedHandler {
  constructor(private readonly recorder: ProbeEventRecorder) {}

  @OnDomainEvent(PostCreated)
  onPostCreated(event: PostCreated): void {
    this.recorder.record('feed.v1', event);
  }
}
