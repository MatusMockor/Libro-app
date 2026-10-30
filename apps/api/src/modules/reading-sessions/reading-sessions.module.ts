import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BooksModule } from '../books/index.js';
import { ProfilesModule } from '../profiles/index.js';
import { EraseReadingDataHandler } from './application/erase-reading-data.handler.js';
import { FinishReadingService } from './application/finish-reading.service.js';
import { GroupMembershipService } from './application/group-membership.service.js';
import { JoinSessionService } from './application/join-session.service.js';
import { LIVE_SESSION_REPOSITORY } from './application/live-session-repository.js';
import { LiveSessionsService } from './application/live-sessions.service.js';
import { READING_GROUP_REPOSITORY } from './application/reading-group-repository.js';
import { ReadingGroupViewService } from './application/reading-group-view.service.js';
import { ReadingActivitySharingService } from './application/reading-activity-sharing.service.js';
import { ReadingPrivacyService } from './application/reading-privacy.service.js';
import { READING_REPOSITORY } from './application/reading-repository.js';
import { READING_SESSION_REPOSITORY } from './application/reading-session-repository.js';
import { SessionLookupService } from './application/session-lookup.service.js';
import { SessionProgressService } from './application/session-progress.service.js';
import { SessionTransitionService } from './application/session-transition.service.js';
import { ReadingStartAnnouncer } from './application/reading-start-announcer.service.js';
import { SessionViewersService } from './application/session-viewers.service.js';
import { SHARING_SETTINGS_REPOSITORY } from './application/sharing-settings-repository.js';
import { StartSessionService } from './application/start-session.service.js';
import { ReadingGroupsController } from './http/reading-groups.controller.js';
import { ReadingPrivacyController } from './http/reading-privacy.controller.js';
import { ReadingSessionsController } from './http/reading-sessions.controller.js';
import { ReadingsController } from './http/readings.controller.js';
import { SessionProgressController } from './http/session-progress.controller.js';
import { CheckpointEntity } from './persistence/checkpoint.entity.js';
import { MarkedPartEntity } from './persistence/marked-part.entity.js';
import { ReadingSessionEntity } from './persistence/reading-session.entity.js';
import { ReadingEntity } from './persistence/reading.entity.js';
import { SessionParticipantEntity } from './persistence/session-participant.entity.js';
import { SharingSettingEntity } from './persistence/sharing-setting.entity.js';
import { TypeOrmLiveSessionRepository } from './persistence/typeorm-live-session.repository.js';
import { TypeOrmReadingGroupRepository } from './persistence/typeorm-reading-group.repository.js';
import { TypeOrmReadingHistoryRepository } from './persistence/typeorm-reading-history.repository.js';
import { TypeOrmReadingSessionRepository } from './persistence/typeorm-reading-session.repository.js';
import { TypeOrmReadingRepository } from './persistence/typeorm-reading.repository.js';
import { TypeOrmSharingSettingsRepository } from './persistence/typeorm-sharing-settings.repository.js';
import { READING_ACTIVITY_SHARING } from './reading-activity-sharing.js';
import { READING_HISTORY } from './reading-history.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReadingEntity,
      ReadingSessionEntity,
      CheckpointEntity,
      MarkedPartEntity,
      SessionParticipantEntity,
      SharingSettingEntity,
    ]),
    BooksModule,
    ProfilesModule,
  ],
  controllers: [
    ReadingSessionsController,
    SessionProgressController,
    ReadingGroupsController,
    ReadingsController,
    ReadingPrivacyController,
  ],
  providers: [
    StartSessionService,
    SessionLookupService,
    SessionTransitionService,
    SessionProgressService,
    FinishReadingService,
    EraseReadingDataHandler,
    SessionViewersService,
    LiveSessionsService,
    ReadingGroupViewService,
    JoinSessionService,
    GroupMembershipService,
    ReadingPrivacyService,
    ReadingStartAnnouncer,
    ReadingActivitySharingService,
    { provide: READING_SESSION_REPOSITORY, useClass: TypeOrmReadingSessionRepository },
    { provide: READING_REPOSITORY, useClass: TypeOrmReadingRepository },
    { provide: READING_HISTORY, useClass: TypeOrmReadingHistoryRepository },
    { provide: READING_GROUP_REPOSITORY, useClass: TypeOrmReadingGroupRepository },
    { provide: LIVE_SESSION_REPOSITORY, useClass: TypeOrmLiveSessionRepository },
    { provide: SHARING_SETTINGS_REPOSITORY, useClass: TypeOrmSharingSettingsRepository },
    { provide: READING_ACTIVITY_SHARING, useExisting: ReadingActivitySharingService },
  ],
  exports: [READING_HISTORY, READING_ACTIVITY_SHARING],
})
export class ReadingSessionsModule {}
