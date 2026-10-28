import { Module } from '@nestjs/common';
import { ProbeEventRecorder } from '../subscriber/probe-event-recorder.js';
import { ProbeReadingSessionsHandler } from './probe-reading-sessions.handler.js';

@Module({
  providers: [ProbeEventRecorder, ProbeReadingSessionsHandler],
})
export class ProbeReadingSessionsSubscriberModule {}
