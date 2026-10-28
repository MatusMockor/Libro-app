import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { FinishReadingService } from '../application/finish-reading.service.js';
import { readingParamsSchema, type ReadingParams } from './reading-params.request.js';
import { readingSchema, toReadingResponse, type ReadingResponse } from './reading.response.js';

@ApiTags('reading-sessions')
@Controller('readings')
export class ReadingsController {
  constructor(private readonly finisher: FinishReadingService) {}

  @Post(':readingId/finish')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description:
      'The book is marked as finished; the next session of it starts a new reading. An unknown reading answers 404 reading_not_found, an open session of it 409 reading_session_open, a finished reading 409 reading_already_finished',
    standardSchema: readingSchema,
  })
  async finish(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: readingParamsSchema }) { readingId }: ReadingParams,
  ): Promise<ReadingResponse> {
    return toReadingResponse(await this.finisher.finish({ userId: id, readingId }));
  }
}
