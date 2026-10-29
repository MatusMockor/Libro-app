import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { OwnProfileService } from '../application/own-profile.service.js';
import { profileSchema, toProfileResponse, type ProfileResponse } from './profile.response.js';
import { updateProfileSchema, type UpdateProfileRequest } from './update-profile.request.js';

@ApiTags('profiles')
@Controller('me/profile')
export class MeProfileController {
  constructor(private readonly profiles: OwnProfileService) {}

  @Get()
  @ApiOkResponse({
    description:
      'The profile of the signed-in user; a missing profile is created with a generated handle',
    standardSchema: profileSchema,
  })
  async find(@CurrentUser() { id }: AuthenticatedUser): Promise<ProfileResponse> {
    return toProfileResponse(await this.profiles.get(id));
  }

  @Patch()
  @ApiOkResponse({
    description:
      'The updated profile. Only the fields in the body change. A taken handle answers 409 handle_taken, an unknown book 404 book_not_found, a photo that is not yours 404 media_not_found',
    standardSchema: profileSchema,
  })
  async update(
    @CurrentUser() { id }: AuthenticatedUser,
    @Body({ schema: updateProfileSchema }) changes: UpdateProfileRequest,
  ): Promise<ProfileResponse> {
    return toProfileResponse(await this.profiles.update(id, changes));
  }
}
