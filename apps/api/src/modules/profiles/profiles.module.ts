import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BooksModule } from '../books/index.js';
import { MediaModule } from '../media/index.js';
import { CreateProfileOnRegistrationHandler } from './application/create-profile-on-registration.handler.js';
import { FOLLOW_REPOSITORY } from './application/follow-repository.js';
import { FollowService } from './application/follow.service.js';
import { HANDLE_SUFFIX_SOURCE } from './application/handle-suffix-source.js';
import { OwnProfileService } from './application/own-profile.service.js';
import { ProfileAssemblerService } from './application/profile-assembler.service.js';
import { ProfileDirectoryService } from './application/profile-directory.service.js';
import { ProfileListsService } from './application/profile-lists.service.js';
import { ProfileLookupService } from './application/profile-lookup.service.js';
import { ProfileProvisioningService } from './application/profile-provisioning.service.js';
import { ProfileReferencesService } from './application/profile-references.service.js';
import { PROFILE_REPOSITORY } from './application/profile-repository.js';
import { PROFILE_SUMMARY_REPOSITORY } from './application/profile-summary-repository.js';
import { SocialGraphService } from './application/social-graph.service.js';
import { FollowsController } from './http/follows.controller.js';
import { MeProfileController } from './http/me-profile.controller.js';
import { ProfilesController } from './http/profiles.controller.js';
import { FollowEntity } from './persistence/follow.entity.js';
import { ProfileEntity } from './persistence/profile.entity.js';
import { TopBookEntity } from './persistence/top-book.entity.js';
import { TypeOrmFollowRepository } from './persistence/typeorm-follow.repository.js';
import { TypeOrmProfileSummaryRepository } from './persistence/typeorm-profile-summary.repository.js';
import { TypeOrmProfileRepository } from './persistence/typeorm-profile.repository.js';
import { PROFILE_DIRECTORY } from './profile-directory.js';
import { RandomHandleSuffixSource } from './security/random-handle-suffix.source.js';
import { SOCIAL_GRAPH } from './social-graph.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProfileEntity, TopBookEntity, FollowEntity]),
    BooksModule,
    MediaModule,
  ],
  controllers: [MeProfileController, ProfilesController, FollowsController],
  providers: [
    ProfileProvisioningService,
    CreateProfileOnRegistrationHandler,
    ProfileAssemblerService,
    ProfileReferencesService,
    OwnProfileService,
    ProfileLookupService,
    ProfileListsService,
    FollowService,
    SocialGraphService,
    ProfileDirectoryService,
    { provide: PROFILE_REPOSITORY, useClass: TypeOrmProfileRepository },
    { provide: PROFILE_SUMMARY_REPOSITORY, useClass: TypeOrmProfileSummaryRepository },
    { provide: FOLLOW_REPOSITORY, useClass: TypeOrmFollowRepository },
    { provide: HANDLE_SUFFIX_SOURCE, useClass: RandomHandleSuffixSource },
    { provide: SOCIAL_GRAPH, useExisting: SocialGraphService },
    { provide: PROFILE_DIRECTORY, useExisting: ProfileDirectoryService },
  ],
  exports: [SOCIAL_GRAPH, PROFILE_DIRECTORY],
})
export class ProfilesModule {}
