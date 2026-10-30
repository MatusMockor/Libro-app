import type { ProfileSummary } from './domain/profile.js';

export const PROFILE_DIRECTORY = Symbol('PROFILE_DIRECTORY');

export const MAX_PROFILE_SUMMARIES_PER_CALL = 100;

export interface ProfileDirectory {
  findSummaries(
    viewerId: string,
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, ProfileSummary>>;
  officialUserIds(): Promise<string[]>;
}
