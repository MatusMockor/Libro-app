import { Injectable } from '@nestjs/common';
import { JsonWebTokenError, JwtService } from '@nestjs/jwt';
import { z } from 'zod';
import type { AccessTokenVerifier } from '../../../http/authentication/access-token-verifier.js';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import type { AccessToken, AccessTokenIssuer } from '../application/access-token-issuer.js';
import { ACCESS_TOKEN_TTL_SECONDS } from './access-token.options.js';

const MILLISECONDS_PER_SECOND = 1_000;

const accessTokenClaimsSchema = z
  .object({ sub: z.uuid(), iat: z.int(), exp: z.int() })
  .refine(({ iat, exp }) => exp - iat <= ACCESS_TOKEN_TTL_SECONDS)
  .refine(({ iat }) => iat <= Math.floor(Date.now() / MILLISECONDS_PER_SECOND));

@Injectable()
export class JwtAccessTokens implements AccessTokenIssuer, AccessTokenVerifier {
  constructor(private readonly jwt: JwtService) {}

  async issue(userId: string): Promise<AccessToken> {
    return {
      value: await this.jwt.signAsync({ sub: userId }),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  async verify(token: string): Promise<AuthenticatedUser | undefined> {
    const claims = accessTokenClaimsSchema.safeParse(await this.verifiedClaims(token));

    return claims.success ? { id: claims.data.sub } : undefined;
  }

  private async verifiedClaims(token: string): Promise<unknown> {
    try {
      return await this.jwt.verifyAsync<object>(token);
    } catch (error) {
      if (error instanceof JsonWebTokenError) {
        return undefined;
      }

      throw error;
    }
  }
}
