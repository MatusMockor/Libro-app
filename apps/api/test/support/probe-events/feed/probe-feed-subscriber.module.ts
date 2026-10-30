import { Module } from '@nestjs/common';
import { ProbeEventRecorder } from '../subscriber/probe-event-recorder.js';
import { ProbePostCreatedHandler } from './probe-post-created.handler.js';

@Module({
  providers: [ProbeEventRecorder, ProbePostCreatedHandler],
})
export class ProbeFeedSubscriberModule {}
