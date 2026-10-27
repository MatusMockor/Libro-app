import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';
import type { Env } from '../config/env.schema.js';
import type { HealthIndicator } from './health-indicator.js';

const CHECK_TIMEOUT_MS = 2_000;

@Injectable()
export class DatabaseHealthIndicator implements HealthIndicator {
  readonly name = 'database';

  constructor(private readonly config: ConfigService<Env, true>) {}

  async isHealthy(): Promise<boolean> {
    const client = this.createClient();

    try {
      await client.connect();
      await client.query('SELECT 1');
      return true;
    } catch {
      return false;
    } finally {
      await client.end();
    }
  }

  private createClient(): pg.Client {
    const client = new pg.Client({
      connectionString: this.config.get('DATABASE_URL', { infer: true }),
      connectionTimeoutMillis: CHECK_TIMEOUT_MS,
      query_timeout: CHECK_TIMEOUT_MS,
    });
    client.on('error', ignore);

    return client;
  }
}

function ignore(): void {}
