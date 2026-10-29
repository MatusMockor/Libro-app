import { Controller, Delete, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { FollowService } from '../application/follow.service.js';
import { profileParamsSchema, type ProfileParams } from './profile-params.request.js';

@ApiTags('profiles')
@Controller('profiles/:userId/follow')
export class FollowsController {
  constructor(private readonly follows: FollowService) {}

  @Put()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description:
      'You follow the user, also when you already did. Your own profile answers 409 cannot_follow_self, an unknown user 404 profile_not_found, following 2000 profiles already 409 follow_limit_reached',
  })
  async follow(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: profileParamsSchema }) { userId }: ProfileParams,
  ): Promise<void> {
    await this.follows.follow(id, userId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description:
      'You no longer follow the user, also when you did not. Your own profile answers 409 cannot_follow_self, an unknown user 404 profile_not_found',
  })
  async unfollow(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: profileParamsSchema }) { userId }: ProfileParams,
  ): Promise<void> {
    await this.follows.unfollow(id, userId);
  }
}
