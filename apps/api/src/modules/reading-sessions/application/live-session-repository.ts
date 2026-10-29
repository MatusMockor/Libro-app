import type {
  LivePageQuery,
  SessionViewer,
  StoredLiveSession,
  StoredReadingGroup,
} from '../domain/reading-group.js';

export const LIVE_SESSION_REPOSITORY = Symbol('LIVE_SESSION_REPOSITORY');

export interface LiveSessionRepository {
  listLive(viewer: SessionViewer, page: LivePageQuery): Promise<StoredLiveSession[]>;
  findGroup(viewer: SessionViewer, sessionId: string): Promise<StoredReadingGroup | undefined>;
}
