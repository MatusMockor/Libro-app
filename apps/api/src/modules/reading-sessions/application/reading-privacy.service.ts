import { Inject, Injectable } from '@nestjs/common';
import {
  DEFAULT_LIVE_SESSION_SHARING,
  type LiveSessionSharing,
} from '../domain/live-session-sharing.js';
import {
  SHARING_SETTINGS_REPOSITORY,
  type SharingSettingsRepository,
} from './sharing-settings-repository.js';

@Injectable()
export class ReadingPrivacyService {
  constructor(
    @Inject(SHARING_SETTINGS_REPOSITORY) private readonly settings: SharingSettingsRepository,
  ) {}

  async liveSessionsOf(userId: string): Promise<LiveSessionSharing> {
    return (await this.settings.liveSessionsOf(userId)) ?? DEFAULT_LIVE_SESSION_SHARING;
  }

  shareLiveSessions(userId: string, sharing: LiveSessionSharing): Promise<LiveSessionSharing> {
    return this.settings.saveLiveSessions(userId, sharing);
  }
}
