import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { AddInsightService } from '../application/add-insight.service.js';
import { DeleteInsightService } from '../application/delete-insight.service.js';
import { addInsightSchema, type AddInsightRequest } from './add-insight.request.js';
import {
  insightParamsSchema,
  readingParamsSchema,
  type InsightParams,
  type ReadingParams,
} from './encouragement-params.request.js';
import {
  insightSchema,
  toInsightResponse,
  type InsightResponse,
} from './encouragement.response.js';

@ApiTags('encouragements')
@Controller()
export class InsightsController {
  constructor(
    private readonly adding: AddInsightService,
    private readonly deleting: DeleteInsightService,
  ) {}

  @Post('readings/:readingId/insights')
  @ApiCreatedResponse({
    description:
      'Adds your insight to the reading in progress of a reader you follow; it waters their tree. A reading you may not encourage answers 404 reading_not_found, your own 409 cannot_encourage_own_reading, a finished one 409 reading_finished, a fourth insight 409 insight_limit_reached',
    standardSchema: insightSchema,
  })
  async add(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: readingParamsSchema }) { readingId }: ReadingParams,
    @Body({ schema: addInsightSchema }) { text }: AddInsightRequest,
  ): Promise<InsightResponse> {
    return toInsightResponse(await this.adding.add(id, readingId, text));
  }

  @Delete('insights/:insightId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description:
      'Deletes the insight, by its author or by the reader of the reading. Anyone else answers 404 insight_not_found',
  })
  async delete(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: insightParamsSchema }) { insightId }: InsightParams,
  ): Promise<void> {
    await this.deleting.delete(id, insightId);
  }
}
