import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../../http/authentication/public.decorator.js';
import { IdentitySignInService } from '../application/identity-sign-in.service.js';
import { SignInNonceService } from '../application/sign-in-nonce.service.js';
import {
  authSessionSchema,
  toAuthSessionResponse,
  type AuthSessionResponse,
} from './auth-session.response.js';
import { identityTokenRequestSchema, type IdentityTokenRequest } from './identity-token.request.js';
import {
  signInNonceSchema,
  toSignInNonceResponse,
  type SignInNonceResponse,
} from './sign-in-nonce.response.js';

@ApiTags('auth')
@Controller('auth/google')
export class GoogleSignInController {
  constructor(
    private readonly nonces: SignInNonceService,
    private readonly signIns: IdentitySignInService,
  ) {}

  @Post('nonce')
  @Public()
  @UseGuards(ThrottlerGuard)
  @ApiCreatedResponse({
    description:
      'A single-use nonce for one Google sign-in, valid for 10 minutes. Answers 503 identity_provider_not_configured when Google sign-in is not set up, too many attempts 429 too_many_requests',
    standardSchema: signInNonceSchema,
  })
  async nonce(): Promise<SignInNonceResponse> {
    return toSignInNonceResponse(await this.nonces.issue('google'));
  }

  @Post()
  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description:
      'Signed in with a Google ID token: the account of the Google identity, else the account with the same email (linked only when Google is authoritative for it: a gmail.com address or a Workspace account whose hd matches the email domain), else a new account. An invalid, expired or foreign token or an unknown, expired or used nonce answers 401 invalid_identity_token, an unverified email 403 identity_email_not_verified, an existing account with an email Google is not authoritative for 409 email_account_exists, an email account already linked to another Google account 409 identity_conflict, Google sign-in not set up 503 identity_provider_not_configured, Google keys unreachable 503 identity_provider_unavailable, too many attempts 429 too_many_requests',
    standardSchema: authSessionSchema,
  })
  async signIn(
    @Body({ schema: identityTokenRequestSchema }) { idToken }: IdentityTokenRequest,
  ): Promise<AuthSessionResponse> {
    return toAuthSessionResponse(await this.signIns.signIn('google', idToken));
  }
}
