import { Inject, Injectable, Logger } from '@nestjs/common';
import { HEALTH_INDICATORS, type HealthIndicator } from './health-indicator.js';
import type { HealthReport } from './health-report.schema.js';

type CheckStatus = HealthReport['checks'][string];

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(@Inject(HEALTH_INDICATORS) private readonly indicators: readonly HealthIndicator[]) {}

  async check(): Promise<HealthReport> {
    const results = await Promise.all(
      this.indicators.map(async (indicator): Promise<[string, CheckStatus]> => [
        indicator.name,
        await this.statusOf(indicator),
      ]),
    );

    return {
      status: results.every(([, status]) => status === 'up') ? 'ok' : 'error',
      checks: Object.fromEntries(results),
    };
  }

  private async statusOf(indicator: HealthIndicator): Promise<CheckStatus> {
    try {
      return (await indicator.isHealthy()) ? 'up' : 'down';
    } catch (error) {
      this.logger.error(
        `Health check "${indicator.name}" failed: ${String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return 'down';
    }
  }
}
