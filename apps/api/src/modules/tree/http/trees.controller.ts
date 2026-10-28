import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { ReadingTreesService } from '../application/reading-trees.service.js';
import { readingTreeParamsSchema, type ReadingTreeParams } from './reading-tree-params.request.js';
import {
  readingTreePageSchema,
  readingTreeSchema,
  toReadingTreePageResponse,
  toReadingTreeResponse,
  type ReadingTreePageResponse,
  type ReadingTreeResponse,
} from './reading-tree.response.js';
import { treePageQuerySchema, type TreePageRequest } from './tree-page.request.js';

@ApiTags('tree')
@Controller()
export class TreesController {
  constructor(private readonly trees: ReadingTreesService) {}

  @Get('readings/:readingId/tree')
  @ApiOkResponse({
    description:
      'The tree of the reading, computed from its ended sessions; a finished reading keeps the tree engine version it was finished with. An unknown reading answers 404 reading_not_found',
    standardSchema: readingTreeSchema,
  })
  async tree(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: readingTreeParamsSchema }) { readingId }: ReadingTreeParams,
  ): Promise<ReadingTreeResponse> {
    return toReadingTreeResponse(await this.trees.treeOf(id, readingId));
  }

  @Get('me/forest')
  @ApiOkResponse({
    description: 'The trees of the finished readings, most recently finished first',
    standardSchema: readingTreePageSchema,
  })
  async forest(
    @CurrentUser() { id }: AuthenticatedUser,
    @Query({ schema: treePageQuerySchema }) page: TreePageRequest,
  ): Promise<ReadingTreePageResponse> {
    return toReadingTreePageResponse(await this.trees.forest(id, page));
  }

  @Get('me/growing-trees')
  @ApiOkResponse({
    description: 'The growing trees of the readings in progress, most recently started first',
    standardSchema: readingTreePageSchema,
  })
  async growingTrees(
    @CurrentUser() { id }: AuthenticatedUser,
    @Query({ schema: treePageQuerySchema }) page: TreePageRequest,
  ): Promise<ReadingTreePageResponse> {
    return toReadingTreePageResponse(await this.trees.growingTrees(id, page));
  }
}
