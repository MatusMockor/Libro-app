import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { authenticatedUserOf } from './authenticated-request.js';
import type { AuthenticatedUser } from './authenticated-user.js';

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthenticatedUser => {
    const user = authenticatedUserOf(context.switchToHttp().getRequest<object>());
    if (!user) {
      throw new Error('@CurrentUser() needs an authenticated route; remove @Public() from it.');
    }

    return user;
  },
);
