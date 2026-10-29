import { Inject, Injectable } from '@nestjs/common';
import type { AccessTokenVerifier } from '../../../http/authentication/access-token-verifier.js';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { USER_REPOSITORY, type UserRepository } from '../application/user-repository.js';
import { SIGNED_ACCESS_TOKEN_VERIFIER } from './signed-access-token-verifier.js';

@Injectable()
export class ExistingAccountAccessTokenVerifier implements AccessTokenVerifier {
  constructor(
    @Inject(SIGNED_ACCESS_TOKEN_VERIFIER) private readonly signedTokens: AccessTokenVerifier,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async verify(token: string): Promise<AuthenticatedUser | undefined> {
    const user = await this.signedTokens.verify(token);
    if (!user) {
      return undefined;
    }

    return (await this.users.exists(user.id)) ? user : undefined;
  }
}
