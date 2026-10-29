import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReadingSessionsModule } from '../reading-sessions/index.js';
import { EraseFinishedTreesHandler } from './application/erase-finished-trees.handler.js';
import { FINISHED_TREE_REPOSITORY } from './application/finished-tree-repository.js';
import { FinishedTreeVersionsService } from './application/finished-tree-versions.service.js';
import { ReadingTreesService } from './application/reading-trees.service.js';
import { RecordFinishedTreeHandler } from './application/record-finished-tree.handler.js';
import { TreesController } from './http/trees.controller.js';
import { FinishedTreeEntity } from './persistence/finished-tree.entity.js';
import { TypeOrmFinishedTreeRepository } from './persistence/typeorm-finished-tree.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([FinishedTreeEntity]), ReadingSessionsModule],
  controllers: [TreesController],
  providers: [
    ReadingTreesService,
    FinishedTreeVersionsService,
    RecordFinishedTreeHandler,
    EraseFinishedTreesHandler,
    { provide: FINISHED_TREE_REPOSITORY, useClass: TypeOrmFinishedTreeRepository },
  ],
})
export class TreeModule {}
