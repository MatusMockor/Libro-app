import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../../http/authentication/public.decorator.js';
import { LoginService } from '../application/login.service.js';
import { RegisterService } from '../application/register.service.js';
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

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registration: RegisterService,
    private readonly signIn: LoginService,
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
}
