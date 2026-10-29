import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACCESS_TOKEN_VERIFIER } from '../../http/authentication/access-token-verifier.js';
import { IdentityProvidersModule } from '../identity-providers/index.js';
import { ACCESS_TOKEN_ISSUER } from './application/access-token-issuer.js';
import { AccountService } from './application/account.service.js';
import { IdentityAccountService } from './application/identity-account.service.js';
import { IDENTITY_REPOSITORY } from './application/identity-repository.js';
import { IdentitySignInService } from './application/identity-sign-in.service.js';
import { LoginService } from './application/login.service.js';
import { PASSWORD_HASHER } from './application/password-hasher.js';
import { REFRESH_TOKEN_GENERATOR } from './application/refresh-token-generator.js';
import { RegisterService } from './application/register.service.js';
import { SESSION_REPOSITORY } from './application/session-repository.js';
import { SessionService } from './application/session.service.js';
import { SIGN_IN_NONCE_GENERATOR } from './application/sign-in-nonce-generator.js';
import { SIGN_IN_NONCE_REPOSITORY } from './application/sign-in-nonce-repository.js';
import { SignInNonceService } from './application/sign-in-nonce.service.js';
import { USER_REPOSITORY } from './application/user-repository.js';
import { AuthController } from './http/auth.controller.js';
import { GoogleSignInController } from './http/google-sign-in.controller.js';
import { MeController } from './http/me.controller.js';
import { IdentityEntity } from './persistence/identity.entity.js';
import { RefreshTokenEntity } from './persistence/refresh-token.entity.js';
import { SessionEntity } from './persistence/session.entity.js';
import { SignInNonceEntity } from './persistence/sign-in-nonce.entity.js';
import { TypeOrmIdentityRepository } from './persistence/typeorm-identity.repository.js';
import { TypeOrmSessionRepository } from './persistence/typeorm-session.repository.js';
import { TypeOrmSignInNonceRepository } from './persistence/typeorm-sign-in-nonce.repository.js';
import { TypeOrmUserRepository } from './persistence/typeorm-user.repository.js';
import { UserEntity } from './persistence/user.entity.js';
import { accessTokenOptions } from './security/access-token.options.js';
import { Argon2PasswordHasher } from './security/argon2-password.hasher.js';
import { JwtAccessTokens } from './security/jwt-access-tokens.js';
import { RandomRefreshTokenGenerator } from './security/random-refresh-token.generator.js';
import { RandomSignInNonceGenerator } from './security/random-sign-in-nonce.generator.js';
import { rateLimitOptions } from './security/rate-limit.options.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      SessionEntity,
      RefreshTokenEntity,
      IdentityEntity,
      SignInNonceEntity,
    ]),
    JwtModule.registerAsync({ inject: [ConfigService], useFactory: accessTokenOptions }),
    ThrottlerModule.forRootAsync({ inject: [ConfigService], useFactory: rateLimitOptions }),
    IdentityProvidersModule,
  ],
  controllers: [AuthController, GoogleSignInController, MeController],
  providers: [
    RegisterService,
    LoginService,
    SessionService,
    AccountService,
    SignInNonceService,
    IdentityAccountService,
    IdentitySignInService,
    JwtAccessTokens,
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: SESSION_REPOSITORY, useClass: TypeOrmSessionRepository },
    { provide: IDENTITY_REPOSITORY, useClass: TypeOrmIdentityRepository },
    { provide: SIGN_IN_NONCE_REPOSITORY, useClass: TypeOrmSignInNonceRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: REFRESH_TOKEN_GENERATOR, useClass: RandomRefreshTokenGenerator },
    { provide: SIGN_IN_NONCE_GENERATOR, useClass: RandomSignInNonceGenerator },
    { provide: ACCESS_TOKEN_ISSUER, useExisting: JwtAccessTokens },
    { provide: ACCESS_TOKEN_VERIFIER, useExisting: JwtAccessTokens },
  ],
  exports: [ACCESS_TOKEN_VERIFIER],
})
export class AuthModule {}
