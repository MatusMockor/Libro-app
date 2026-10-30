import { Module } from '@nestjs/common';
import { ProbeEventRecorder } from '../subscriber/probe-event-recorder.js';
import { ProbeEncouragementsHandler } from './probe-encouragements.handler.js';

@Module({
  providers: [ProbeEventRecorder, ProbeEncouragementsHandler],
})
export class ProbeEncouragementsSubscriberModule {}
