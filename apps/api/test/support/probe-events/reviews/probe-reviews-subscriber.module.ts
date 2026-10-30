import { Module } from '@nestjs/common';
import { ProbeEventRecorder } from '../subscriber/probe-event-recorder.js';
import { ProbeReviewPublishedHandler } from './probe-review-published.handler.js';

@Module({
  providers: [ProbeEventRecorder, ProbeReviewPublishedHandler],
})
export class ProbeReviewsSubscriberModule {}
