import { Module } from '@nestjs/common';
import { ProbeProtectedController } from './probe-protected.controller.js';
import { ProbeController } from './probe.controller.js';

@Module({
  controllers: [ProbeController, ProbeProtectedController],
})
export class ProbeModule {}
