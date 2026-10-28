import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACCESS_TOKEN_VERIFIER } from '../../http/authentication/access-token-verifier.js';
import { ACCESS_TOKEN_ISSUER } from './application/access-token-issuer.js';
import { AccountService } from './application/account.service.js';
import { LoginService } from './application/login.service.js';
import { PASSWORD_HASHER } from './application/password-hasher.js';
import { RegisterService } from './application/register.service.js';
import { SessionService } from './application/session.service.js';
import { USER_REPOSITORY } from './application/user-repository.js';
import { AuthController } from './http/auth.controller.js';
import { MeController } from './http/me.controller.js';
import { TypeOrmUserRepository } from './persistence/typeorm-user.repository.js';
import { UserEntity } from './persistence/user.entity.js';
import { accessTokenOptions } from './security/access-token.options.js';
import { Argon2PasswordHasher } from './security/argon2-password.hasher.js';
import { JwtAccessTokens } from './security/jwt-access-tokens.js';
import { rateLimitOptions } from './security/rate-limit.options.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    JwtModule.registerAsync({ inject: [ConfigService], useFactory: accessTokenOptions }),
    ThrottlerModule.forRootAsync({ inject: [ConfigService], useFactory: rateLimitOptions }),
  ],
  controllers: [AuthController, MeController],
  providers: [
    RegisterService,
    LoginService,
    SessionService,
    AccountService,
    JwtAccessTokens,
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: ACCESS_TOKEN_ISSUER, useExisting: JwtAccessTokens },
    { provide: ACCESS_TOKEN_VERIFIER, useExisting: JwtAccessTokens },
  ],
  exports: [ACCESS_TOKEN_VERIFIER],
})
export class AuthModule {}
