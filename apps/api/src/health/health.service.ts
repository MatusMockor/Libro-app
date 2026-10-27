import { Inject, Injectable } from '@nestjs/common';
import { HEALTH_INDICATORS, type HealthIndicator } from './health-indicator.js';
import type { HealthReport } from './health-report.schema.js';

type CheckStatus = HealthReport['checks'][string];

@Injectable()
export class HealthService {
  constructor(@Inject(HEALTH_INDICATORS) private readonly indicators: readonly HealthIndicator[]) {}

  async check(): Promise<HealthReport> {
    const results = await Promise.all(
      this.indicators.map(async (indicator): Promise<[string, CheckStatus]> => [
        indicator.name,
        (await indicator.isHealthy()) ? 'up' : 'down',
      ]),
    );

    return {
      status: results.every(([, status]) => status === 'up') ? 'ok' : 'error',
      checks: Object.fromEntries(results),
    };
  }
}
