import type { WorkSummary } from '../../books/index.js';
import type { ProfileSummary } from '../../profiles/index.js';
import type { SessionStatus } from './reading-session.js';

export const MAX_GROUP_PARTICIPANTS = 20;

export const LIVE_PAGE_MAX_OFFSET = 1000;

export interface SessionViewer {
  readonly userId: string;
  readonly followeeIds: readonly string[];
}

export interface SessionSnapshot {
  readonly sessionId: string;
  readonly userId: string;
  readonly place: string | null;
  readonly status: SessionStatus;
  readonly startedAt: Date;
  readonly progressPage: number | null;
}

export interface StoredLiveSession extends SessionSnapshot {
  readonly workId: string;
  readonly participantCount: number;
  readonly joinedByMe: boolean;
}

export interface LiveSession extends Omit<StoredLiveSession, 'userId' | 'workId'> {
  readonly host: ProfileSummary;
  readonly book: WorkSummary | null;
}

export interface StoredGroupMember extends SessionSnapshot {
  readonly joinedAt: Date | null;
}

export interface StoredReadingGroup {
  readonly workId: string;
  readonly hostSessionId: string;
  readonly members: readonly StoredGroupMember[];
}

export interface GroupMember extends Omit<StoredGroupMember, 'userId'> {
  readonly reader: ProfileSummary;
}

export interface ReadingGroup {
  readonly book: WorkSummary | null;
  readonly host: GroupMember | null;
  readonly participants: readonly GroupMember[];
}

export interface LivePageQuery {
  readonly limit: number;
  readonly offset: number;
}

export interface LivePage {
  readonly items: readonly LiveSession[];
  readonly nextOffset: number | null;
}
