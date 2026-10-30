import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { ReadingPrivacyService } from '../application/reading-privacy.service.js';
import {
  readingPrivacyRequestSchema,
  type ReadingPrivacyRequest,
} from './reading-privacy.request.js';
import {
  readingPrivacySchema,
  toReadingPrivacyResponse,
  type ReadingPrivacyResponse,
} from './reading-privacy.response.js';

@ApiTags('reading-sessions')
@Controller('me/reading-privacy')
export class ReadingPrivacyController {
  constructor(private readonly privacy: ReadingPrivacyService) {}

  @Get()
  @ApiOkResponse({
    description:
      'Who sees your open reading session and your reading activity in the feed; followers until you change it',
    standardSchema: readingPrivacySchema,
  })
  async find(@CurrentUser() { id }: AuthenticatedUser): Promise<ReadingPrivacyResponse> {
    return toReadingPrivacyResponse(await this.privacy.of(id));
  }

  @Put()
  @ApiOkResponse({
    description:
      'The settings sent were saved, the others kept; they apply at once, also to a session already open and to reading activity already in the feed',
    standardSchema: readingPrivacySchema,
  })
  async update(
    @CurrentUser() { id }: AuthenticatedUser,
    @Body({ schema: readingPrivacyRequestSchema }) privacy: ReadingPrivacyRequest,
  ): Promise<ReadingPrivacyResponse> {
    return toReadingPrivacyResponse(await this.privacy.change(id, privacy));
  }
}
