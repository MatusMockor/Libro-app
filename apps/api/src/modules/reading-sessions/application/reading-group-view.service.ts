import { Inject, Injectable } from '@nestjs/common';
import { BOOK_CATALOGUE, type BookCatalogue } from '../../books/index.js';
import {
  PROFILE_DIRECTORY,
  type ProfileDirectory,
  type ProfileSummary,
} from '../../profiles/index.js';
import type { GroupMember, ReadingGroup, StoredGroupMember } from '../domain/reading-group.js';
import { LIVE_SESSION_REPOSITORY, type LiveSessionRepository } from './live-session-repository.js';
import { ReadingSessionNotFoundException } from './reading-session-not-found.exception.js';
import { SessionViewersService } from './session-viewers.service.js';

@Injectable()
export class ReadingGroupViewService {
  constructor(
    @Inject(LIVE_SESSION_REPOSITORY) private readonly live: LiveSessionRepository,
    @Inject(PROFILE_DIRECTORY) private readonly profiles: ProfileDirectory,
    @Inject(BOOK_CATALOGUE) private readonly catalogue: BookCatalogue,
    private readonly viewers: SessionViewersService,
  ) {}

  async groupOf(userId: string, sessionId: string): Promise<ReadingGroup> {
    const group = await this.live.findGroup(await this.viewers.of(userId), sessionId);
    if (!group) {
      throw new ReadingSessionNotFoundException();
    }

    const readers = await this.profiles.findSummaries(
      userId,
      group.members.map((member) => member.userId),
    );
    const books = await this.catalogue.findWorkSummaries([group.workId]);
    const members = group.members.flatMap((member) => withReader(member, readers));

    return {
      book: books.get(group.workId) ?? null,
      host: members.find((member) => member.sessionId === group.hostSessionId) ?? null,
      participants: members.filter((member) => member.sessionId !== group.hostSessionId),
    };
  }
}

function withReader(
  { userId, ...member }: StoredGroupMember,
  readers: ReadonlyMap<string, ProfileSummary>,
): GroupMember[] {
  const reader = readers.get(userId);

  return reader ? [{ ...member, reader }] : [];
}
