import { Controller, Get } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../src/http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../src/http/authentication/current-user.decorator.js';

@Controller('probe/protected')
export class ProbeProtectedController {
  @Get()
  whoAmI(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
