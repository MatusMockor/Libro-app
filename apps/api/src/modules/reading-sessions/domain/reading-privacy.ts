import { DEFAULT_LIVE_SESSION_SHARING, type LiveSessionSharing } from './live-session-sharing.js';

export const READING_ACTIVITY_AUDIENCES = ['followers', 'nobody'] as const;

export type ReadingActivityAudience = (typeof READING_ACTIVITY_AUDIENCES)[number];

export const READING_ACTIVITY_SHARED_WITH_FOLLOWERS: ReadingActivityAudience = 'followers';

export interface ReadingPrivacy {
  readonly liveSessions: LiveSessionSharing;
  readonly readingActivity: ReadingActivityAudience;
}

export interface ReadingPrivacyChanges {
  readonly liveSessions?: LiveSessionSharing | undefined;
  readonly readingActivity?: ReadingActivityAudience | undefined;
}

export const DEFAULT_READING_PRIVACY: ReadingPrivacy = {
  liveSessions: DEFAULT_LIVE_SESSION_SHARING,
  readingActivity: READING_ACTIVITY_SHARED_WITH_FOLLOWERS,
};
