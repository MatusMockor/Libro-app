import { Inject, Injectable } from '@nestjs/common';
import { distinctIdBatch } from '../../../shared/id-batch.js';
import {
  MAX_READING_ACTIVITY_SHARING_CHECKS_PER_CALL,
  type ReadingActivitySharing,
} from '../reading-activity-sharing.js';
import {
  SHARING_SETTINGS_REPOSITORY,
  type SharingSettingsRepository,
} from './sharing-settings-repository.js';

@Injectable()
export class ReadingActivitySharingService implements ReadingActivitySharing {
  constructor(
    @Inject(SHARING_SETTINGS_REPOSITORY) private readonly settings: SharingSettingsRepository,
  ) {}

  async sharingWithFollowers(userIds: readonly string[]): Promise<ReadonlySet<string>> {
    const distinct = distinctIdBatch(userIds, MAX_READING_ACTIVITY_SHARING_CHECKS_PER_CALL);
    if (distinct.length === 0) {
      return new Set();
    }

    return new Set(await this.settings.sharingReadingActivity(distinct));
  }
}
