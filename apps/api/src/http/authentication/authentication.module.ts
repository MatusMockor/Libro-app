import { Module, type DynamicModule, type ModuleMetadata } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticationGuard } from './authentication.guard.js';

export interface AuthenticationModuleOptions {
  readonly verifierFrom: NonNullable<ModuleMetadata['imports']>;
}

@Module({})
export class AuthenticationModule {
  static forRoot({ verifierFrom }: AuthenticationModuleOptions): DynamicModule {
    return {
      module: AuthenticationModule,
      imports: verifierFrom,
      providers: [{ provide: APP_GUARD, useClass: AuthenticationGuard }],
    };
  }
}
