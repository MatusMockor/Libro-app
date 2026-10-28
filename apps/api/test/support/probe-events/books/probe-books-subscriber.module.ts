import { Module } from '@nestjs/common';
import { ProbeEventRecorder } from '../subscriber/probe-event-recorder.js';
import { ProbeBookAddedHandler } from './probe-book-added.handler.js';

@Module({
  providers: [ProbeEventRecorder, ProbeBookAddedHandler],
})
export class ProbeBooksSubscriberModule {}
