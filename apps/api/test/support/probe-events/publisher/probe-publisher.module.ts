import { Module } from '@nestjs/common';
import { ProbePublisherController } from './probe-publisher.controller.js';

@Module({
  controllers: [ProbePublisherController],
})
export class ProbePublisherModule {}
