import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { AccountDeletionService } from '../application/account-deletion.service.js';
import {
  accountDeletionRequestSchema,
  toDeletionConfirmation,
  type AccountDeletionRequest,
} from './account-deletion.request.js';

@ApiTags('auth')
@Controller('me')
export class AccountDeletionController {
  constructor(private readonly deletion: AccountDeletionService) {}

  @Post('deletion')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description:
      'The account and all its data are deleted right away, without a grace period; every access and refresh token of it stops working. Confirm with the password, or with a fresh Google ID token of a Google account linked to this account. A wrong password (or an account without one) answers 401 invalid_credentials, a valid Google token of a Google account not linked to this account 401 identity_not_linked, an invalid, expired or reused Google token or nonce 401 invalid_identity_token, Google sign-in not set up 503 identity_provider_not_configured, Google keys unreachable 503 identity_provider_unavailable, too many attempts 429 too_many_requests',
  })
  async delete(
    @CurrentUser() { id }: AuthenticatedUser,
    @Body({ schema: accountDeletionRequestSchema }) request: AccountDeletionRequest,
  ): Promise<void> {
    await this.deletion.delete(id, toDeletionConfirmation(request));
  }
}
