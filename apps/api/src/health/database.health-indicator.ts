import { setTimeout as delay } from 'node:timers/promises';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { HealthIndicator } from './health-indicator.js';

const CHECK_TIMEOUT_MS = 2_000;

@Injectable()
export class DatabaseHealthIndicator implements HealthIndicator {
  readonly name = 'database';

  constructor(private readonly dataSource: DataSource) {}

  async isHealthy(): Promise<boolean> {
    const timeout = new AbortController();

    try {
      return await Promise.race([this.ping(), this.timedOut(timeout.signal)]);
    } catch {
      return false;
    } finally {
      timeout.abort();
    }
  }

  private async ping(): Promise<boolean> {
    await this.dataSource.query('SELECT 1');
    return true;
  }

  private async timedOut(signal: AbortSignal): Promise<boolean> {
    await delay(CHECK_TIMEOUT_MS, undefined, { signal });
    return false;
  }
}
