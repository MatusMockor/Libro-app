import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EVENT_BUS } from './event-bus.js';
import { EventEmitterEventBus } from './event-emitter.event-bus.js';
import { SingletonHandlersCheck } from './singleton-handlers.check.js';

@Global()
@Module({
  imports: [DiscoveryModule, EventEmitterModule.forRoot({ global: false, wildcard: false })],
  providers: [{ provide: EVENT_BUS, useClass: EventEmitterEventBus }, SingletonHandlersCheck],
  exports: [EVENT_BUS],
})
export class EventsModule {}
