import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { ProfileListsService } from '../application/profile-lists.service.js';
import { ProfileLookupService } from '../application/profile-lookup.service.js';
import { GENRES } from '../domain/genres.js';
import {
  profilePageQuerySchema,
  searchProfilesQuerySchema,
  type ProfilePageQuery,
  type SearchProfilesQuery,
} from './profile-page.request.js';
import {
  handleParamsSchema,
  profileParamsSchema,
  type HandleParams,
  type ProfileParams,
} from './profile-params.request.js';
import {
  genresSchema,
  profileSchema,
  profileSummaryPageSchema,
  toProfileResponse,
  toProfileSummaryPageResponse,
  type GenresResponse,
  type ProfileResponse,
  type ProfileSummaryPageResponse,
} from './profile.response.js';

@ApiTags('profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly lookup: ProfileLookupService,
    private readonly lists: ProfileListsService,
  ) {}

  @Get()
  @ApiOkResponse({
    description:
      'Profiles whose handle or display name contains every word of q, ignoring case and diacritics. Best match first',
    standardSchema: profileSummaryPageSchema,
  })
  async search(
    @CurrentUser() { id }: AuthenticatedUser,
    @Query({ schema: searchProfilesQuerySchema }) { q, limit, offset }: SearchProfilesQuery,
  ): Promise<ProfileSummaryPageResponse> {
    return toProfileSummaryPageResponse(await this.lists.search(id, { text: q, limit, offset }));
  }

  @Get('genres')
  @ApiOkResponse({
    description: 'The genre keys a profile can pick as favourites',
    standardSchema: genresSchema,
  })
  genres(): GenresResponse {
    return { genres: [...GENRES] };
  }

  @Get('by-handle/:handle')
  @ApiOkResponse({
    description:
      'The profile with this handle, compared case-insensitively. An unknown handle answers 404 profile_not_found',
    standardSchema: profileSchema,
  })
  async findByHandle(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: handleParamsSchema }) { handle }: HandleParams,
  ): Promise<ProfileResponse> {
    return toProfileResponse(await this.lookup.byHandle(id, handle));
  }

  @Get(':userId')
  @ApiOkResponse({
    description: 'The profile of the user. An unknown user answers 404 profile_not_found',
    standardSchema: profileSchema,
  })
  async find(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: profileParamsSchema }) { userId }: ProfileParams,
  ): Promise<ProfileResponse> {
    return toProfileResponse(await this.lookup.byId(id, userId));
  }

  @Get(':userId/followers')
  @ApiOkResponse({
    description:
      'The profiles following the user, most recent follow first. An unknown user answers 404 profile_not_found',
    standardSchema: profileSummaryPageSchema,
  })
  async followers(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: profileParamsSchema }) { userId }: ProfileParams,
    @Query({ schema: profilePageQuerySchema }) page: ProfilePageQuery,
  ): Promise<ProfileSummaryPageResponse> {
    return toProfileSummaryPageResponse(await this.lists.followers(id, userId, page));
  }

  @Get(':userId/following')
  @ApiOkResponse({
    description:
      'The profiles the user follows, most recent follow first. An unknown user answers 404 profile_not_found',
    standardSchema: profileSummaryPageSchema,
  })
  async following(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: profileParamsSchema }) { userId }: ProfileParams,
    @Query({ schema: profilePageQuerySchema }) page: ProfilePageQuery,
  ): Promise<ProfileSummaryPageResponse> {
    return toProfileSummaryPageResponse(await this.lists.following(id, userId, page));
  }
}
