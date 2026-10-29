import { Inject, Injectable } from '@nestjs/common';
import type { ReadingSession } from '../domain/reading-session.js';
import { GroupParticipantNotFoundException } from './group-participant-not-found.exception.js';
import { NotInGroupException } from './not-in-group.exception.js';
import {
  READING_GROUP_REPOSITORY,
  type LeaveOutcome,
  type ParticipantRemoval,
  type ReadingGroupRepository,
  type RemovalOutcome,
} from './reading-group-repository.js';
import { ReadingSessionEndedException } from './reading-session-ended.exception.js';
import { ReadingSessionNotFoundException } from './reading-session-not-found.exception.js';
import type { SessionOwner } from './reading-session-repository.js';
import { SessionLookupService } from './session-lookup.service.js';

const LEAVE_REJECTIONS: Readonly<Record<Exclude<LeaveOutcome['kind'], 'left'>, new () => Error>> = {
  not_found: ReadingSessionNotFoundException,
  not_in_group: NotInGroupException,
};

const REMOVAL_REJECTIONS: Readonly<
  Record<Exclude<RemovalOutcome['kind'], 'removed'>, new () => Error>
> = {
  not_found: ReadingSessionNotFoundException,
  ended: ReadingSessionEndedException,
  participant_not_found: GroupParticipantNotFoundException,
};

@Injectable()
export class GroupMembershipService {
  constructor(
    @Inject(READING_GROUP_REPOSITORY) private readonly groups: ReadingGroupRepository,
    private readonly lookup: SessionLookupService,
  ) {}

  async leave(participant: SessionOwner): Promise<ReadingSession> {
    const outcome = await this.groups.leave(participant);
    if (outcome.kind !== 'left') {
      throw new LEAVE_REJECTIONS[outcome.kind]();
    }

    return this.lookup.get(participant);
  }

  async remove(removal: ParticipantRemoval): Promise<void> {
    const outcome = await this.groups.removeParticipant(removal);
    if (outcome.kind !== 'removed') {
      throw new REMOVAL_REJECTIONS[outcome.kind]();
    }
  }
}
