import { Module } from '@nestjs/common';
import { ProbeEventRecorder } from '../subscriber/probe-event-recorder.js';
import { ProbeUserDeletedHandler } from './probe-user-deleted.handler.js';
import { ProbeUserRegisteredHandler } from './probe-user-registered.handler.js';

@Module({
  providers: [ProbeEventRecorder, ProbeUserRegisteredHandler, ProbeUserDeletedHandler],
})
export class ProbeAuthSubscriberModule {}
