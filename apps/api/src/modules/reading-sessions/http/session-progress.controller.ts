import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { SessionProgressService } from '../application/session-progress.service.js';
import { addCheckpointSchema, type AddCheckpointRequest } from './add-checkpoint.request.js';
import { markPartSchema, type MarkPartRequest } from './mark-part.request.js';
import {
  checkpointSchema,
  markedPartSchema,
  toCheckpointResponse,
  toMarkedPartResponse,
  type CheckpointResponse,
  type MarkedPartResponse,
} from './reading-session.response.js';
import { sessionParamsSchema, type SessionParams } from './session-params.request.js';

@ApiTags('reading-sessions')
@Controller('reading-sessions/:sessionId')
export class SessionProgressController {
  constructor(private readonly progress: SessionProgressService) {}

  @Post('checkpoints')
  @ApiCreatedResponse({
    description:
      'The checkpoint was recorded. An unknown session answers 404 reading_session_not_found, a session that is not active 409 reading_session_not_active, a session with 500 checkpoints 409 reading_session_limit_reached',
    standardSchema: checkpointSchema,
  })
  async addCheckpoint(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: sessionParamsSchema }) { sessionId }: SessionParams,
    @Body({ schema: addCheckpointSchema }) { page }: AddCheckpointRequest,
  ): Promise<CheckpointResponse> {
    return toCheckpointResponse(await this.progress.addCheckpoint({ userId: id, sessionId }, page));
  }

  @Post('marked-parts')
  @ApiCreatedResponse({
    description:
      'The part was marked. An unknown session answers 404 reading_session_not_found, an ended session 409 reading_session_ended, a session with 100 marked parts 409 reading_session_limit_reached',
    standardSchema: markedPartSchema,
  })
  async markPart(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: sessionParamsSchema }) { sessionId }: SessionParams,
    @Body({ schema: markPartSchema }) part: MarkPartRequest,
  ): Promise<MarkedPartResponse> {
    return toMarkedPartResponse(await this.progress.markPart({ userId: id, sessionId }, part));
  }
}
