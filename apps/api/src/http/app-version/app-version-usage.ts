import type { AppClient } from './app-client.js';

export const APP_VERSION_USAGE = Symbol('APP_VERSION_USAGE');

export type AppVersionOutcome = 'accepted' | 'outdated' | 'invalid';

export interface AppVersionUsage {
  record(client: AppClient | undefined, outcome: AppVersionOutcome): void;
}
