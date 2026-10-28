import { Module } from '@nestjs/common';
import { ProbeFailingHandler } from './probe-failing.handler.js';

@Module({
  providers: [ProbeFailingHandler],
})
export class ProbeFailingModule {}
