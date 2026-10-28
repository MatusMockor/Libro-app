import { Module } from '@nestjs/common';
import { ProbeEventRecorder } from '../subscriber/probe-event-recorder.js';
import { ProbeUserRegisteredHandler } from './probe-user-registered.handler.js';

@Module({
  providers: [ProbeEventRecorder, ProbeUserRegisteredHandler],
})
export class ProbeAuthSubscriberModule {}
