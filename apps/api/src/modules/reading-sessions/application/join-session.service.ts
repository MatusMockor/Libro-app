import { Inject, Injectable } from '@nestjs/common';
import { normalisePlace } from '../domain/place.js';
import type { ReadingSession } from '../domain/reading-session.js';
import { CannotJoinOwnSessionException } from './cannot-join-own-session.exception.js';
import { GroupFullException } from './group-full.exception.js';
import {
  READING_GROUP_REPOSITORY,
  type JoinOutcome,
  type ReadingGroupRepository,
} from './reading-group-repository.js';
import { ReadingSessionAlreadyOpenException } from './reading-session-already-open.exception.js';
import { ReadingSessionEndedException } from './reading-session-ended.exception.js';
import { ReadingSessionNotFoundException } from './reading-session-not-found.exception.js';
import { RemovedFromGroupException } from './removed-from-group.exception.js';
import { SessionLookupService } from './session-lookup.service.js';
import { SessionViewersService } from './session-viewers.service.js';

type Rejection = Exclude<JoinOutcome['kind'], 'joined'>;

const REJECTIONS: Readonly<Record<Rejection, new () => Error>> = {
  not_found: ReadingSessionNotFoundException,
  own_session: CannotJoinOwnSessionException,
  already_open: ReadingSessionAlreadyOpenException,
  ended: ReadingSessionEndedException,
  removed: RemovedFromGroupException,
  full: GroupFullException,
};

export interface SessionJoin {
  readonly targetSessionId: string;
  readonly place: string | null;
}

@Injectable()
export class JoinSessionService {
  constructor(
    @Inject(READING_GROUP_REPOSITORY) private readonly groups: ReadingGroupRepository,
    private readonly viewers: SessionViewersService,
    private readonly lookup: SessionLookupService,
  ) {}

  async join(userId: string, { targetSessionId, place }: SessionJoin): Promise<ReadingSession> {
    const outcome = await this.groups.join({
      viewer: await this.viewers.of(userId),
      targetSessionId,
      place: normalisePlace(place),
    });
    if (outcome.kind !== 'joined') {
      throw new REJECTIONS[outcome.kind]();
    }

    return this.lookup.get({ userId, sessionId: outcome.sessionId });
  }
}
