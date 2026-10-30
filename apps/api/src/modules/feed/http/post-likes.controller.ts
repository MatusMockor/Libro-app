import { Controller, Delete, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { LikeService } from '../application/like.service.js';
import { postParamsSchema, type PostParams } from './post-params.request.js';

@ApiTags('feed')
@Controller('posts/:postId/like')
export class PostLikesController {
  constructor(private readonly likes: LikeService) {}

  @Put()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description:
      'You like the post, also when you already did. An unknown post answers 404 post_not_found',
  })
  async like(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: postParamsSchema }) { postId }: PostParams,
  ): Promise<void> {
    await this.likes.like(id, postId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description:
      'You no longer like the post, also when you did not. An unknown post answers 404 post_not_found',
  })
  async unlike(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: postParamsSchema }) { postId }: PostParams,
  ): Promise<void> {
    await this.likes.unlike(id, postId);
  }
}
