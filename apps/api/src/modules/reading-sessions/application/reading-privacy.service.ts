import { Inject, Injectable } from '@nestjs/common';
import {
  DEFAULT_READING_PRIVACY,
  type ReadingPrivacy,
  type ReadingPrivacyChanges,
} from '../domain/reading-privacy.js';
import {
  SHARING_SETTINGS_REPOSITORY,
  type SharingSettingsRepository,
} from './sharing-settings-repository.js';

@Injectable()
export class ReadingPrivacyService {
  constructor(
    @Inject(SHARING_SETTINGS_REPOSITORY) private readonly settings: SharingSettingsRepository,
  ) {}

  async of(userId: string): Promise<ReadingPrivacy> {
    return (await this.settings.privacyOf(userId)) ?? DEFAULT_READING_PRIVACY;
  }

  change(userId: string, changes: ReadingPrivacyChanges): Promise<ReadingPrivacy> {
    return this.settings.savePrivacy(userId, changes);
  }
}
