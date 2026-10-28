import { Module } from '@nestjs/common';
import { ProbeEventRecorder } from './probe-event-recorder.js';
import { ProbeGate } from './probe-gate.js';
import { ProbeShelfHandler } from './probe-shelf.handler.js';
import { ProbeStatsHandler } from './probe-stats.handler.js';

@Module({
  providers: [ProbeEventRecorder, ProbeGate, ProbeShelfHandler, ProbeStatsHandler],
})
export class ProbeSubscriberModule {}
