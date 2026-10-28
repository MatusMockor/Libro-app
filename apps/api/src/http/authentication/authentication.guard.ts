import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { IncomingMessage } from 'node:http';
import { ACCESS_TOKEN_VERIFIER, type AccessTokenVerifier } from './access-token-verifier.js';
import { attachAuthenticatedUser } from './authenticated-request.js';
import { AuthenticationRequiredException } from './authentication-required.exception.js';
import { bearerToken } from './bearer-token.js';
import { InvalidAccessTokenException } from './invalid-access-token.exception.js';
import { PUBLIC_ROUTE } from './public.decorator.js';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ACCESS_TOKEN_VERIFIER) private readonly verifier: AccessTokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) {
      return true;
    }

    if (context.getType() !== 'http') {
      return false;
    }

    const request = context.switchToHttp().getRequest<IncomingMessage>();
    const token = bearerToken(request.headers);
    if (!token) {
      throw new AuthenticationRequiredException();
    }

    const user = await this.verifier.verify(token);
    if (!user) {
      throw new InvalidAccessTokenException();
    }

    attachAuthenticatedUser(request, user);
    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean | undefined>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}
