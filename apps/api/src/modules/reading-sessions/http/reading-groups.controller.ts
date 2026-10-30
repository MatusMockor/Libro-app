import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { GroupMembershipService } from '../application/group-membership.service.js';
import { JoinSessionService } from '../application/join-session.service.js';
import { ReadingGroupViewService } from '../application/reading-group-view.service.js';
import { joinSessionSchema, type JoinSessionRequest } from './join-session.request.js';
import {
  readingGroupSchema,
  toReadingGroupResponse,
  type ReadingGroupResponse,
} from './live-session.response.js';
import { participantParamsSchema, type ParticipantParams } from './participant-params.request.js';
import {
  readingSessionSchema,
  toReadingSessionResponse,
  type ReadingSessionResponse,
} from './reading-session.response.js';
import { sessionParamsSchema, type SessionParams } from './session-params.request.js';

@ApiTags('reading-sessions')
@Controller('reading-sessions')
export class ReadingGroupsController {
  constructor(
    private readonly groups: ReadingGroupViewService,
    private readonly joiner: JoinSessionService,
    private readonly membership: GroupMembershipService,
  ) {}

  @Get(':sessionId/group')
  @ApiOkResponse({
    description:
      'The reading group of a session you may see: its host and current participants, each only when you may see their session (members of one group always see each other). A session you may not see answers 404 reading_session_not_found',
    standardSchema: readingGroupSchema,
  })
  async group(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: sessionParamsSchema }) { sessionId }: SessionParams,
  ): Promise<ReadingGroupResponse> {
    return toReadingGroupResponse(await this.groups.groupOf(id, sessionId));
  }

  @Post(':sessionId/join')
  @ApiCreatedResponse({
    description:
      'You started your own session of the same book in the reading group of the session (joining a participant joins its host). A session you may not see answers 404 reading_session_not_found, your own 409 cannot_join_own_session, another open session of yours 409 reading_session_already_open, an ended group 409 reading_session_ended, a group you were removed from 403 removed_from_group, a group with 20 participants 409 group_full',
    standardSchema: readingSessionSchema,
  })
  async join(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: sessionParamsSchema }) { sessionId }: SessionParams,
    @Body({ schema: joinSessionSchema }) { place }: JoinSessionRequest,
  ): Promise<ReadingSessionResponse> {
    return toReadingSessionResponse(
      await this.joiner.join(id, { targetSessionId: sessionId, place }),
    );
  }

  @Post(':sessionId/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description:
      'Your session left its reading group and goes on alone. An unknown session answers 404 reading_session_not_found, a session that is not a participant of an open group 409 not_in_group',
    standardSchema: readingSessionSchema,
  })
  async leave(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: sessionParamsSchema }) { sessionId }: SessionParams,
  ): Promise<ReadingSessionResponse> {
    return toReadingSessionResponse(await this.membership.leave({ userId: id, sessionId }));
  }

  @Delete(':hostSessionId/participants/:participantSessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description:
      'The participant was removed from your reading group (also when already removed) and cannot join it again; their session goes on alone. An unknown host session answers 404 reading_session_not_found, an ended one 409 reading_session_ended, a session that never joined it 404 group_participant_not_found',
  })
  async remove(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: participantParamsSchema })
    { hostSessionId, participantSessionId }: ParticipantParams,
  ): Promise<void> {
    await this.membership.remove({
      host: { userId: id, sessionId: hostSessionId },
      participantSessionId,
    });
  }
}
