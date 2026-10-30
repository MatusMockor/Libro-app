import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { EncouragementListsService } from '../application/encouragement-lists.service.js';
import {
  encouragementPageQuerySchema,
  toEncouragementPageQuery,
  type EncouragementPageRequest,
} from './encouragement-page.request.js';
import { readingParamsSchema, type ReadingParams } from './encouragement-params.request.js';
import {
  encouragementPageSchema,
  toEncouragementPageResponse,
  type EncouragementPageResponse,
} from './encouragement.response.js';

@ApiTags('encouragements')
@Controller('readings/:readingId/encouragements')
export class EncouragementsController {
  constructor(private readonly lists: EncouragementListsService) {}

  @Get()
  @ApiOkResponse({
    description:
      'Insights and congratulations of the reading, newest first: all of them for its reader, only your own for a follower of the reader. Anyone else answers 404 reading_not_found',
    standardSchema: encouragementPageSchema,
  })
  async list(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: readingParamsSchema }) { readingId }: ReadingParams,
    @Query({ schema: encouragementPageQuerySchema }) page: EncouragementPageRequest,
  ): Promise<EncouragementPageResponse> {
    return toEncouragementPageResponse(
      await this.lists.ofReading(id, readingId, toEncouragementPageQuery(page)),
    );
  }
}
