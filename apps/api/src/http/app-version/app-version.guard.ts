import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { identifyAppClient } from './app-client-headers.js';
import type { AppClient } from './app-client.js';
import { AppUpdateRequiredException } from './app-update-required.exception.js';
import { APP_VERSION_POLICY, type AppVersionPolicy } from './app-version-policy.js';
import { APP_VERSION_USAGE, type AppVersionUsage } from './app-version-usage.js';
import { InvalidAppClientException } from './invalid-app-client.exception.js';

@Injectable()
export class AppVersionGuard implements CanActivate {
  constructor(
    @Inject(APP_VERSION_POLICY) private readonly policy: AppVersionPolicy,
    @Inject(APP_VERSION_USAGE) private readonly usage: AppVersionUsage,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const identity = identifyAppClient(
      context.switchToHttp().getRequest<IncomingMessage>().headers,
    );

    if (identity.kind === 'invalid') {
      this.usage.record(undefined, 'invalid');
      throw new InvalidAppClientException(identity.reason);
    }

    if (identity.kind === 'anonymous') {
      return true;
    }

    return this.admit(identity.client);
  }

  private admit(client: AppClient): boolean {
    if (!this.policy.isSupported(client)) {
      this.usage.record(client, 'outdated');
      throw new AppUpdateRequiredException(this.policy.minimumVersion(client.platform));
    }

    this.usage.record(client, 'accepted');
    return true;
  }
}
