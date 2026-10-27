import type { LoggerService } from '@nestjs/common';
import { describe, expect } from 'vitest';
import { DatabaseHealthIndicator } from '../src/health/database.health-indicator.js';
import { HEALTH_INDICATORS, type HealthIndicator } from '../src/health/health-indicator.js';
import { integrationTest } from './support/integration-test.js';

class RejectingHealthIndicator implements HealthIndicator {
  readonly name = 'search';

  isHealthy(): Promise<boolean> {
    return Promise.reject(new Error('search index at 10.0.0.5:9200 exploded'));
  }
}

class CapturingLogger implements LoggerService {
  readonly errors: string[] = [];

  log(): void {}

  warn(): void {}

  error(...parts: unknown[]): void {
    this.errors.push(parts.map(String).join('\n'));
  }
}

const test = integrationTest({
  configure: (builder) =>
    builder.overrideProvider(HEALTH_INDICATORS).useFactory({
      inject: [DatabaseHealthIndicator],
      factory: (database: DatabaseHealthIndicator): HealthIndicator[] => [
        database,
        new RejectingHealthIndicator(),
      ],
    }),
});

describe('GET /health with a failing indicator', () => {
  test('reports the failing check as down and keeps the others', async ({ app, http }) => {
    const logger = new CapturingLogger();
    app.useLogger(logger);

    const response = await http.get('/health');

    expect(response.status).toBe(503);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toEqual({ status: 'error', checks: { database: 'up', search: 'down' } });
    expect(response.text).not.toContain('10.0.0.5');
    expect(logger.errors).toHaveLength(1);
    expect(logger.errors[0]).toContain('search index at 10.0.0.5:9200 exploded');
  });
});
