import { Injectable } from '@nestjs/common';
import { OnDomainEvent } from '../../../../src/events/on-domain-event.decorator.js';
import { ReviewPublished } from '../../../../src/modules/reviews/index.js';
import { ProbeEventRecorder } from '../subscriber/probe-event-recorder.js';

@Injectable()
export class ProbeReviewPublishedHandler {
  constructor(private readonly recorder: ProbeEventRecorder) {}

  @OnDomainEvent(ReviewPublished)
  onReviewPublished(event: ReviewPublished): void {
    this.recorder.record('reviews.v1', event);
  }
}
