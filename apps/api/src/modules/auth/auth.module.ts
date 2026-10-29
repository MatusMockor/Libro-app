import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACCESS_TOKEN_VERIFIER } from '../../http/authentication/access-token-verifier.js';
import { IdentityProvidersModule } from '../identity-providers/index.js';
import { ACCESS_TOKEN_ISSUER } from './application/access-token-issuer.js';
import { AccountDeletionService } from './application/account-deletion.service.js';
import { AccountService } from './application/account.service.js';
import { DELETED_ACCOUNT_REPOSITORY } from './application/deleted-account-repository.js';
import { DeletedAccountsPurgeService } from './application/deleted-accounts-purge.service.js';
import { DeletionReplayService } from './application/deletion-replay.service.js';
import { IdentityAccountService } from './application/identity-account.service.js';
import { IdentityConfirmationService } from './application/identity-confirmation.service.js';
import { IDENTITY_REPOSITORY } from './application/identity-repository.js';
import { IdentitySignInService } from './application/identity-sign-in.service.js';
import { IdentityTokenService } from './application/identity-token.service.js';
import { LoginService } from './application/login.service.js';
import { PasswordCheckService } from './application/password-check.service.js';
import { PasswordConfirmationService } from './application/password-confirmation.service.js';
import { PASSWORD_HASHER } from './application/password-hasher.js';
import { REFRESH_TOKEN_GENERATOR } from './application/refresh-token-generator.js';
import { RegisterService } from './application/register.service.js';
import { SESSION_REPOSITORY } from './application/session-repository.js';
import { SessionService } from './application/session.service.js';
import { SIGN_IN_NONCE_GENERATOR } from './application/sign-in-nonce-generator.js';
import { SIGN_IN_NONCE_REPOSITORY } from './application/sign-in-nonce-repository.js';
import { SignInNonceService } from './application/sign-in-nonce.service.js';
import { TASK_SCHEDULER } from './application/task-scheduler.js';
import { USER_REPOSITORY } from './application/user-repository.js';
import { DELETED_ACCOUNTS_PURGE } from './deleted-accounts-purge.js';
import { AccountDeletionController } from './http/account-deletion.controller.js';
import { AuthController } from './http/auth.controller.js';
import { GoogleSignInController } from './http/google-sign-in.controller.js';
import { MeController } from './http/me.controller.js';
import { DeletedAccountEntity } from './persistence/deleted-account.entity.js';
import { IdentityEntity } from './persistence/identity.entity.js';
import { RefreshTokenEntity } from './persistence/refresh-token.entity.js';
import { SessionEntity } from './persistence/session.entity.js';
import { SignInNonceEntity } from './persistence/sign-in-nonce.entity.js';
import { TypeOrmDeletedAccountRepository } from './persistence/typeorm-deleted-account.repository.js';
import { TypeOrmIdentityRepository } from './persistence/typeorm-identity.repository.js';
import { TypeOrmSessionRepository } from './persistence/typeorm-session.repository.js';
import { TypeOrmSignInNonceRepository } from './persistence/typeorm-sign-in-nonce.repository.js';
import { TypeOrmUserRepository } from './persistence/typeorm-user.repository.js';
import { UserEntity } from './persistence/user.entity.js';
import { TimerTaskScheduler } from './scheduling/timer-task.scheduler.js';
import { accessTokenOptions } from './security/access-token.options.js';
import { Argon2PasswordHasher } from './security/argon2-password.hasher.js';
import { ExistingAccountAccessTokenVerifier } from './security/existing-account-access-token.verifier.js';
import { JwtAccessTokens } from './security/jwt-access-tokens.js';
import { RandomRefreshTokenGenerator } from './security/random-refresh-token.generator.js';
import { RandomSignInNonceGenerator } from './security/random-sign-in-nonce.generator.js';
import { rateLimitOptions } from './security/rate-limit.options.js';
import { SIGNED_ACCESS_TOKEN_VERIFIER } from './security/signed-access-token-verifier.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      SessionEntity,
      RefreshTokenEntity,
      IdentityEntity,
      SignInNonceEntity,
      DeletedAccountEntity,
    ]),
    JwtModule.registerAsync({ inject: [ConfigService], useFactory: accessTokenOptions }),
    ThrottlerModule.forRootAsync({ inject: [ConfigService], useFactory: rateLimitOptions }),
    IdentityProvidersModule,
  ],
  controllers: [AuthController, GoogleSignInController, MeController, AccountDeletionController],
  providers: [
    RegisterService,
    LoginService,
    SessionService,
    AccountService,
    SignInNonceService,
    IdentityAccountService,
    IdentitySignInService,
    IdentityTokenService,
    PasswordCheckService,
    PasswordConfirmationService,
    IdentityConfirmationService,
    AccountDeletionService,
    DeletionReplayService,
    JwtAccessTokens,
    ExistingAccountAccessTokenVerifier,
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: SESSION_REPOSITORY, useClass: TypeOrmSessionRepository },
    { provide: IDENTITY_REPOSITORY, useClass: TypeOrmIdentityRepository },
    { provide: SIGN_IN_NONCE_REPOSITORY, useClass: TypeOrmSignInNonceRepository },
    { provide: DELETED_ACCOUNT_REPOSITORY, useClass: TypeOrmDeletedAccountRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: REFRESH_TOKEN_GENERATOR, useClass: RandomRefreshTokenGenerator },
    { provide: SIGN_IN_NONCE_GENERATOR, useClass: RandomSignInNonceGenerator },
    { provide: TASK_SCHEDULER, useClass: TimerTaskScheduler },
    { provide: ACCESS_TOKEN_ISSUER, useExisting: JwtAccessTokens },
    { provide: SIGNED_ACCESS_TOKEN_VERIFIER, useExisting: JwtAccessTokens },
    { provide: ACCESS_TOKEN_VERIFIER, useExisting: ExistingAccountAccessTokenVerifier },
    { provide: DELETED_ACCOUNTS_PURGE, useClass: DeletedAccountsPurgeService },
  ],
  exports: [ACCESS_TOKEN_VERIFIER, DELETED_ACCOUNTS_PURGE],
})
export class AuthModule {}
