import { Logger } from '@nestjs/common';
import { errors, jwtVerify, type JWTPayload } from 'jose';
import { IdentityProviderUnavailableException } from '../application/identity-provider-unavailable.exception.js';
import { InvalidIdentityTokenException } from '../application/invalid-identity-token.exception.js';
import type { VerifiedIdentity } from '../domain/verified-identity.js';
import {
  ID_TOKEN_ALGORITHMS,
  ID_TOKEN_CLOCK_TOLERANCE_SECONDS,
  ID_TOKEN_REQUIRED_CLAIMS,
  idTokenClaimsProblem,
  idTokenClaimsSchema,
} from './id-token-claims.js';
import type { OidcProviderConfig } from './oidc-provider-config.js';

const TOKEN_ERRORS = [
  errors.JWSSignatureVerificationFailed,
  errors.JWTClaimValidationFailed,
  errors.JWTExpired,
  errors.JWSInvalid,
  errors.JWTInvalid,
  errors.JOSEAlgNotAllowed,
  errors.JOSENotSupported,
  errors.JWKSNoMatchingKey,
  errors.JWKSMultipleMatchingKeys,
];

export class OidcIdTokenVerifier {
  private readonly logger = new Logger(OidcIdTokenVerifier.name);

  constructor(private readonly config: OidcProviderConfig) {}

  async verify(idToken: string): Promise<VerifiedIdentity> {
    const claims = idTokenClaimsSchema.safeParse(await this.verifiedPayload(idToken));
    if (!claims.success) {
      return this.reject('claims have unexpected types');
    }

    const problem = idTokenClaimsProblem(claims.data, this.config.clientIds, new Date());
    if (problem) {
      return this.reject(problem);
    }

    return {
      provider: this.config.provider,
      subject: claims.data.sub,
      email: typeof claims.data.email === 'string' ? claims.data.email : undefined,
      emailVerified: claims.data.email_verified === true,
      nonce: claims.data.nonce,
    };
  }

  private async verifiedPayload(idToken: string): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(idToken, this.config.signingKeys, {
        algorithms: ID_TOKEN_ALGORITHMS,
        issuer: [...this.config.issuers],
        audience: [...this.config.clientIds],
        requiredClaims: ID_TOKEN_REQUIRED_CLAIMS,
        clockTolerance: ID_TOKEN_CLOCK_TOLERANCE_SECONDS,
      });

      return payload;
    } catch (error) {
      if (isTokenError(error)) {
        return this.reject(`${error.code}: ${error.message}`);
      }

      return this.unavailable(error);
    }
  }

  private unavailable(cause: unknown): never {
    const reason = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
    this.logger.warn(`Could not verify a ${this.config.provider} ID token: ${reason}`);
    throw new IdentityProviderUnavailableException();
  }

  private reject(reason: string): never {
    this.logger.debug(`Rejected ${this.config.provider} ID token: ${reason}`);
    throw new InvalidIdentityTokenException();
  }
}

function isTokenError(error: unknown): error is errors.JOSEError {
  return TOKEN_ERRORS.some((tokenError) => error instanceof tokenError);
}
