import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { LiveSessionsService } from '../application/live-sessions.service.js';
import { SessionLookupService } from '../application/session-lookup.service.js';
import { SessionTransitionService } from '../application/session-transition.service.js';
import { StartSessionService } from '../application/start-session.service.js';
import type { SessionTransition } from '../domain/session-transition.js';
import {
  livePageSchema,
  toLivePageResponse,
  type LivePageResponse,
} from './live-session.response.js';
import { livePageQuerySchema, type LivePageRequest } from './live-sessions.request.js';
import {
  readingSessionSchema,
  toReadingSessionResponse,
  type ReadingSessionResponse,
} from './reading-session.response.js';
import { sessionParamsSchema, type SessionParams } from './session-params.request.js';
import { startSessionSchema, type StartSessionRequest } from './start-session.request.js';

const NOT_FOUND = 'An unknown session or one of another user answers 404 reading_session_not_found';

const INVALID_TRANSITION = `${NOT_FOUND}, a session in another state 409 invalid_session_transition`;

@ApiTags('reading-sessions')
@Controller('reading-sessions')
export class ReadingSessionsController {
  constructor(
    private readonly starter: StartSessionService,
    private readonly lookup: SessionLookupService,
    private readonly transitions: SessionTransitionService,
    private readonly liveSessions: LiveSessionsService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    description:
      'The session was started in the unfinished reading of the book, or in a new reading. An unknown book answers 404 book_not_found, another open session 409 reading_session_already_open',
    standardSchema: readingSessionSchema,
  })
  async start(
    @CurrentUser() { id }: AuthenticatedUser,
    @Body({ schema: startSessionSchema }) session: StartSessionRequest,
  ): Promise<ReadingSessionResponse> {
    return toReadingSessionResponse(await this.starter.start(id, session));
  }

  @Get('current')
  @ApiOkResponse({
    description:
      'The open (active or paused) session. Without one it answers 404 reading_session_not_found',
    standardSchema: readingSessionSchema,
  })
  async current(@CurrentUser() { id }: AuthenticatedUser): Promise<ReadingSessionResponse> {
    return toReadingSessionResponse(await this.lookup.current(id));
  }

  @Get('live')
  @ApiOkResponse({
    description:
      'Open (active or paused) sessions of the people you follow that you may see, most recently started first. A reader who shares live sessions with nobody is left out unless you read in the same reading group',
    standardSchema: livePageSchema,
  })
  async live(
    @CurrentUser() { id }: AuthenticatedUser,
    @Query({ schema: livePageQuerySchema }) page: LivePageRequest,
  ): Promise<LivePageResponse> {
    return toLivePageResponse(await this.liveSessions.list(id, page));
  }

  @Get(':sessionId')
  @ApiOkResponse({
    description: `The session with its checkpoints and marked parts. ${NOT_FOUND}`,
    standardSchema: readingSessionSchema,
  })
  async find(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: sessionParamsSchema }) { sessionId }: SessionParams,
  ): Promise<ReadingSessionResponse> {
    return toReadingSessionResponse(await this.lookup.get({ userId: id, sessionId }));
  }

  @Post(':sessionId/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: `The active session was paused. ${INVALID_TRANSITION}`,
    standardSchema: readingSessionSchema,
  })
  pause(
    @CurrentUser() user: AuthenticatedUser,
    @Param({ schema: sessionParamsSchema }) params: SessionParams,
  ): Promise<ReadingSessionResponse> {
    return this.apply(user, params, 'pause');
  }

  @Post(':sessionId/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: `The paused session is active again. ${INVALID_TRANSITION}`,
    standardSchema: readingSessionSchema,
  })
  resume(
    @CurrentUser() user: AuthenticatedUser,
    @Param({ schema: sessionParamsSchema }) params: SessionParams,
  ): Promise<ReadingSessionResponse> {
    return this.apply(user, params, 'resume');
  }

  @Post(':sessionId/end')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: `The active or paused session was ended. ${INVALID_TRANSITION}`,
    standardSchema: readingSessionSchema,
  })
  end(
    @CurrentUser() user: AuthenticatedUser,
    @Param({ schema: sessionParamsSchema }) params: SessionParams,
  ): Promise<ReadingSessionResponse> {
    return this.apply(user, params, 'end');
  }

  private async apply(
    { id }: AuthenticatedUser,
    { sessionId }: SessionParams,
    transition: SessionTransition,
  ): Promise<ReadingSessionResponse> {
    return toReadingSessionResponse(
      await this.transitions.apply({ userId: id, sessionId }, transition),
    );
  }
}
