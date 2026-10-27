import { Injectable, Logger } from '@nestjs/common';
import type { AppClient } from './app-client.js';
import type { AppVersionOutcome, AppVersionUsage } from './app-version-usage.js';

const UNKNOWN = 'unknown';

@Injectable()
export class LoggerAppVersionUsage implements AppVersionUsage {
  private readonly logger = new Logger('AppVersion');

  record(client: AppClient | undefined, outcome: AppVersionOutcome): void {
    const platform = client?.platform ?? UNKNOWN;
    const version = client?.version.toString() ?? UNKNOWN;

    this.logger.log(`client platform=${platform} version=${version} outcome=${outcome}`);
  }
}
