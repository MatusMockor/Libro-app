import type { ReadingPrivacy, ReadingPrivacyChanges } from '../domain/reading-privacy.js';

export const SHARING_SETTINGS_REPOSITORY = Symbol('SHARING_SETTINGS_REPOSITORY');

export interface SharingSettingsRepository {
  privacyOf(userId: string): Promise<ReadingPrivacy | undefined>;
  savePrivacy(userId: string, changes: ReadingPrivacyChanges): Promise<ReadingPrivacy>;
  sharingReadingActivity(userIds: readonly string[]): Promise<string[]>;
}
