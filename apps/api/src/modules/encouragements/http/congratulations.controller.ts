import { Controller, Delete, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { CongratulationsService } from '../application/congratulations.service.js';
import {
  congratulationParamsSchema,
  readingParamsSchema,
  type CongratulationParams,
  type ReadingParams,
} from './encouragement-params.request.js';

@ApiTags('encouragements')
@Controller('readings/:readingId')
export class CongratulationsController {
  constructor(private readonly congratulations: CongratulationsService) {}

  @Put('congratulation')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description:
      'Congratulates a reader you follow on the finished reading, once; it adds fruit to their tree. Idempotent. A reading you may not encourage answers 404 reading_not_found, your own 409 cannot_encourage_own_reading, an unfinished one 409 reading_not_finished',
  })
  async congratulate(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: readingParamsSchema }) { readingId }: ReadingParams,
  ): Promise<void> {
    await this.congratulations.congratulate(id, readingId);
  }

  @Delete('congratulation')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Withdraws your congratulation on the reading, whether or not there was one',
  })
  async withdraw(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: readingParamsSchema }) { readingId }: ReadingParams,
  ): Promise<void> {
    await this.congratulations.withdraw(id, readingId);
  }

  @Delete('congratulations/:authorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description:
      'Removes the congratulation of that author from your reading, whether or not there was one. A reading of another reader or an unknown one answers 404 reading_not_found',
  })
  async remove(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: congratulationParamsSchema }) { readingId, authorId }: CongratulationParams,
  ): Promise<void> {
    await this.congratulations.remove(id, readingId, authorId);
  }
}
