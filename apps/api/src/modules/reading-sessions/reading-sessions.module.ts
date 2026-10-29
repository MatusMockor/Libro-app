import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BooksModule } from '../books/index.js';
import { EraseReadingDataHandler } from './application/erase-reading-data.handler.js';
import { FinishReadingService } from './application/finish-reading.service.js';
import { READING_REPOSITORY } from './application/reading-repository.js';
import { READING_SESSION_REPOSITORY } from './application/reading-session-repository.js';
import { SessionLookupService } from './application/session-lookup.service.js';
import { SessionProgressService } from './application/session-progress.service.js';
import { SessionTransitionService } from './application/session-transition.service.js';
import { StartSessionService } from './application/start-session.service.js';
import { ReadingSessionsController } from './http/reading-sessions.controller.js';
import { ReadingsController } from './http/readings.controller.js';
import { SessionProgressController } from './http/session-progress.controller.js';
import { CheckpointEntity } from './persistence/checkpoint.entity.js';
import { MarkedPartEntity } from './persistence/marked-part.entity.js';
import { ReadingSessionEntity } from './persistence/reading-session.entity.js';
import { ReadingEntity } from './persistence/reading.entity.js';
import { TypeOrmReadingHistoryRepository } from './persistence/typeorm-reading-history.repository.js';
import { TypeOrmReadingSessionRepository } from './persistence/typeorm-reading-session.repository.js';
import { TypeOrmReadingRepository } from './persistence/typeorm-reading.repository.js';
import { READING_HISTORY } from './reading-history.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReadingEntity,
      ReadingSessionEntity,
      CheckpointEntity,
      MarkedPartEntity,
    ]),
    BooksModule,
  ],
  controllers: [ReadingSessionsController, SessionProgressController, ReadingsController],
  providers: [
    StartSessionService,
    SessionLookupService,
    SessionTransitionService,
    SessionProgressService,
    FinishReadingService,
    EraseReadingDataHandler,
    { provide: READING_SESSION_REPOSITORY, useClass: TypeOrmReadingSessionRepository },
    { provide: READING_REPOSITORY, useClass: TypeOrmReadingRepository },
    { provide: READING_HISTORY, useClass: TypeOrmReadingHistoryRepository },
  ],
  exports: [READING_HISTORY],
})
export class ReadingSessionsModule {}
