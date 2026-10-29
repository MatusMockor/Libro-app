import type { ProfileSearchQuery, StoredProfileSummary } from '../domain/profile.js';
import type { PageQuery } from '../domain/profile-page.js';

export const PROFILE_SUMMARY_REPOSITORY = Symbol('PROFILE_SUMMARY_REPOSITORY');

export interface ProfileSummaryRepository {
  search(viewerId: string, query: ProfileSearchQuery): Promise<StoredProfileSummary[]>;
  followersOf(viewerId: string, userId: string, page: PageQuery): Promise<StoredProfileSummary[]>;
  followingOf(viewerId: string, userId: string, page: PageQuery): Promise<StoredProfileSummary[]>;
  findByUserIds(viewerId: string, userIds: readonly string[]): Promise<StoredProfileSummary[]>;
}
