import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesModule } from '../profiles/index.js';
import { ReadingSessionsModule } from '../reading-sessions/index.js';
import { AddInsightService } from './application/add-insight.service.js';
import { CONGRATULATION_REPOSITORY } from './application/congratulation-repository.js';
import { CongratulationsService } from './application/congratulations.service.js';
import { DeleteInsightService } from './application/delete-insight.service.js';
import { EncouragementAuthorsService } from './application/encouragement-authors.service.js';
import { EncouragementListsService } from './application/encouragement-lists.service.js';
import { ENCOURAGEMENT_REPOSITORY } from './application/encouragement-repository.js';
import { EncouragementTargetService } from './application/encouragement-target.service.js';
import { EraseEncouragementsHandler } from './application/erase-encouragements.handler.js';
import { INSIGHT_REPOSITORY } from './application/insight-repository.js';
import { ReadingEncouragementsService } from './application/reading-encouragements.service.js';
import { CongratulationsController } from './http/congratulations.controller.js';
import { EncouragementsController } from './http/encouragements.controller.js';
import { InsightsController } from './http/insights.controller.js';
import { CongratulationEntity } from './persistence/congratulation.entity.js';
import { InsightEntity } from './persistence/insight.entity.js';
import { TypeOrmCongratulationRepository } from './persistence/typeorm-congratulation.repository.js';
import { TypeOrmEncouragementRepository } from './persistence/typeorm-encouragement.repository.js';
import { TypeOrmInsightRepository } from './persistence/typeorm-insight.repository.js';
import { READING_ENCOURAGEMENTS } from './reading-encouragements.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([InsightEntity, CongratulationEntity]),
    ReadingSessionsModule,
    ProfilesModule,
  ],
  controllers: [InsightsController, CongratulationsController, EncouragementsController],
  providers: [
    EncouragementTargetService,
    EncouragementAuthorsService,
    AddInsightService,
    DeleteInsightService,
    CongratulationsService,
    EncouragementListsService,
    EraseEncouragementsHandler,
    { provide: READING_ENCOURAGEMENTS, useClass: ReadingEncouragementsService },
    { provide: INSIGHT_REPOSITORY, useClass: TypeOrmInsightRepository },
    { provide: CONGRATULATION_REPOSITORY, useClass: TypeOrmCongratulationRepository },
    { provide: ENCOURAGEMENT_REPOSITORY, useClass: TypeOrmEncouragementRepository },
  ],
  exports: [READING_ENCOURAGEMENTS],
})
export class EncouragementsModule {}
