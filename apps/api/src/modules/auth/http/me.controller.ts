import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { AccountService } from '../application/account.service.js';
import { toUserResponse, userSchema, type UserResponse } from './user.response.js';

@ApiTags('auth')
@Controller('me')
export class MeController {
  constructor(private readonly accounts: AccountService) {}

  @Get()
  @ApiOkResponse({ description: 'The signed-in user', standardSchema: userSchema })
  async find(@CurrentUser() { id }: AuthenticatedUser): Promise<UserResponse> {
    return toUserResponse(await this.accounts.getAccount(id));
  }
}
