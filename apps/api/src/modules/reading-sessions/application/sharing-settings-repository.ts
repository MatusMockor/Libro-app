import type { LiveSessionSharing } from '../domain/live-session-sharing.js';

export const SHARING_SETTINGS_REPOSITORY = Symbol('SHARING_SETTINGS_REPOSITORY');

export interface SharingSettingsRepository {
  liveSessionsOf(userId: string): Promise<LiveSessionSharing | undefined>;
  saveLiveSessions(userId: string, sharing: LiveSessionSharing): Promise<LiveSessionSharing>;
}
