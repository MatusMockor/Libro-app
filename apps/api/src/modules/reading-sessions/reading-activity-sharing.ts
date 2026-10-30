export const READING_ACTIVITY_SHARING = Symbol('READING_ACTIVITY_SHARING');

export const MAX_READING_ACTIVITY_SHARING_CHECKS_PER_CALL = 2001;

export interface ReadingActivitySharing {
  sharingWithFollowers(userIds: readonly string[]): Promise<ReadonlySet<string>>;
}
