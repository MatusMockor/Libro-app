import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../../http/authentication/public.decorator.js';
import { LoginService } from '../application/login.service.js';
import { RegisterService } from '../application/register.service.js';
import { SessionService } from '../application/session.service.js';
import {
  loginSchema,
  registerSchema,
  type LoginRequest,
  type RegisterRequest,
} from './credentials.request.js';
import {
  authSessionSchema,
  toAuthSessionResponse,
  type AuthSessionResponse,
} from './auth-session.response.js';
import { refreshTokenRequestSchema, type RefreshTokenRequest } from './refresh-token.request.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registration: RegisterService,
    private readonly signIn: LoginService,
    private readonly sessions: SessionService,
  ) {}

  @Post('register')
  @Public()
  @UseGuards(ThrottlerGuard)
  @ApiCreatedResponse({
    description:
      'The account was created and signed in. A taken email answers 409 email_already_registered, too many attempts 429 too_many_requests',
    standardSchema: authSessionSchema,
  })
  async register(
    @Body({ schema: registerSchema }) credentials: RegisterRequest,
  ): Promise<AuthSessionResponse> {
    return toAuthSessionResponse(await this.registration.register(credentials));
  }

  @Post('login')
  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description:
      'Signed in. A wrong email or password answers 401 invalid_credentials, too many attempts 429 too_many_requests',
    standardSchema: authSessionSchema,
  })
  async login(
    @Body({ schema: loginSchema }) credentials: LoginRequest,
  ): Promise<AuthSessionResponse> {
    return toAuthSessionResponse(await this.signIn.login(credentials));
  }

  @Post('refresh')
  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description:
      'New tokens for the same sign-in; the presented refresh token is used up. An unknown, used, revoked or expired refresh token answers 401 invalid_refresh_token, and a used one also ends its sign-in',
    standardSchema: authSessionSchema,
  })
  async refresh(
    @Body({ schema: refreshTokenRequestSchema }) { refreshToken }: RefreshTokenRequest,
  ): Promise<AuthSessionResponse> {
    return toAuthSessionResponse(await this.sessions.refresh(refreshToken));
  }

  @Post('logout')
  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description:
      'The sign-in of the refresh token is ended, also when the token was unknown or already revoked. Access tokens stay valid until they expire',
  })
  async logout(
    @Body({ schema: refreshTokenRequestSchema }) { refreshToken }: RefreshTokenRequest,
  ): Promise<void> {
    await this.sessions.end(refreshToken);
  }
}
