import { Module } from '@nestjs/common';
import { DatabaseHealthIndicator } from './database.health-indicator.js';
import { HEALTH_INDICATORS, type HealthIndicator } from './health-indicator.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  controllers: [HealthController],
  providers: [
    DatabaseHealthIndicator,
    {
      provide: HEALTH_INDICATORS,
      inject: [DatabaseHealthIndicator],
      useFactory: (...indicators: HealthIndicator[]): HealthIndicator[] => indicators,
    },
    HealthService,
  ],
})
export class HealthModule {}
