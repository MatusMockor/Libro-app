import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configModuleOptions } from './config/config-module.options.js';
import { envFilePaths, WORKSPACE_ROOT } from './config/env-file-paths.js';
import { DatabaseModule } from './database/database.module.js';
import { EventsModule } from './events/events.module.js';
import { HealthModule } from './health/health.module.js';
import { AppVersionModule } from './http/app-version/app-version.module.js';
import { AuthenticationModule } from './http/authentication/authentication.module.js';
import { HttpApiModule } from './http/http-api.module.js';
import { AuthModule } from './modules/auth/index.js';
import { BooksModule } from './modules/books/index.js';
import { FeedModule } from './modules/feed/index.js';
import { IdentityProvidersModule } from './modules/identity-providers/index.js';
import { MediaModule } from './modules/media/index.js';
import { ProfilesModule } from './modules/profiles/index.js';
import { ReadingSessionsModule } from './modules/reading-sessions/index.js';
import { TreeModule } from './modules/tree/index.js';

@Module({
  imports: [
    ConfigModule.forRoot(configModuleOptions(envFilePaths(process.env.NODE_ENV, WORKSPACE_ROOT))),
    DatabaseModule,
    EventsModule,
    HttpApiModule,
    AppVersionModule,
    AuthenticationModule.forRoot({ verifierFrom: [AuthModule] }),
    HealthModule,
    IdentityProvidersModule,
    AuthModule,
    BooksModule,
    ReadingSessionsModule,
    TreeModule,
    MediaModule,
    ProfilesModule,
    FeedModule,
  ],
})
export class AppModule {}
