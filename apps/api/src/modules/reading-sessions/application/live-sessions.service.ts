import { Inject, Injectable } from '@nestjs/common';
import { BOOK_CATALOGUE, type BookCatalogue } from '../../books/index.js';
import { PROFILE_DIRECTORY, type ProfileDirectory } from '../../profiles/index.js';
import {
  LIVE_PAGE_MAX_OFFSET,
  type LivePage,
  type LivePageQuery,
  type LiveSession,
} from '../domain/reading-group.js';
import { LIVE_SESSION_REPOSITORY, type LiveSessionRepository } from './live-session-repository.js';
import { SessionViewersService } from './session-viewers.service.js';

const EMPTY_PAGE: LivePage = { items: [], nextOffset: null };

@Injectable()
export class LiveSessionsService {
  constructor(
    @Inject(LIVE_SESSION_REPOSITORY) private readonly live: LiveSessionRepository,
    @Inject(PROFILE_DIRECTORY) private readonly profiles: ProfileDirectory,
    @Inject(BOOK_CATALOGUE) private readonly catalogue: BookCatalogue,
    private readonly viewers: SessionViewersService,
  ) {}

  async list(userId: string, { limit, offset }: LivePageQuery): Promise<LivePage> {
    const viewer = await this.viewers.of(userId);
    if (viewer.followeeIds.length === 0) {
      return EMPTY_PAGE;
    }

    const found = await this.live.listLive(viewer, { limit: limit + 1, offset });
    const sessions = found.slice(0, limit);
    const hosts = await this.profiles.findSummaries(
      userId,
      sessions.map((session) => session.userId),
    );
    const books = await this.catalogue.findWorkSummaries(sessions.map((session) => session.workId));
    const nextOffset = offset + limit;
    const hasNextPage = found.length > limit && nextOffset <= LIVE_PAGE_MAX_OFFSET;

    return {
      items: sessions.flatMap(({ userId: hostId, workId, ...session }): LiveSession[] => {
        const host = hosts.get(hostId);

        return host ? [{ ...session, host, book: books.get(workId) ?? null }] : [];
      }),
      nextOffset: hasNextPage ? nextOffset : null,
    };
  }
}
