import { z } from 'zod';

export const ID_TOKEN_ALGORITHMS = ['RS256'];
export const ID_TOKEN_CLOCK_TOLERANCE_SECONDS = 60;
export const ID_TOKEN_REQUIRED_CLAIMS = ['iss', 'sub', 'aud', 'exp', 'iat', 'nonce'];

const SUBJECT_MAX_LENGTH = 255;
const MILLISECONDS_PER_SECOND = 1_000;

export const idTokenClaimsSchema = z.object({
  sub: z.string().min(1).max(SUBJECT_MAX_LENGTH),
  aud: z.union([z.string(), z.array(z.string()).min(1)]),
  azp: z.string().optional(),
  iat: z.number(),
  nonce: z.string().min(1),
  email: z.unknown().optional(),
  email_verified: z.unknown().optional(),
  hd: z.unknown().optional(),
});

export type IdTokenClaims = z.infer<typeof idTokenClaimsSchema>;

export function idTokenClaimsProblem(
  claims: IdTokenClaims,
  clientIds: readonly string[],
  now: Date,
): string | undefined {
  const audiences = typeof claims.aud === 'string' ? [claims.aud] : claims.aud;

  if (audiences.some((audience) => !clientIds.includes(audience))) {
    return 'aud lists an audience that is not one of our client ids';
  }

  if (audiences.length > 1 && claims.azp === undefined) {
    return 'azp is required when aud has more than one value';
  }

  if (claims.azp !== undefined && !clientIds.includes(claims.azp)) {
    return 'azp is not one of our client ids';
  }

  if (claims.iat > now.getTime() / MILLISECONDS_PER_SECOND + ID_TOKEN_CLOCK_TOLERANCE_SECONDS) {
    return 'iat is in the future';
  }

  return undefined;
}
