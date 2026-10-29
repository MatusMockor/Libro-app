import { z } from 'zod';

const ID_TOKEN_MAX_LENGTH = 4096;

const COMPACT_JWS_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export const idTokenSchema = z
  .string()
  .max(ID_TOKEN_MAX_LENGTH)
  .regex(COMPACT_JWS_PATTERN, { error: 'Must be a compact JWS (three base64url segments)' })
  .meta({
    description:
      'The ID token the provider SDK returned on the device, issued with the nonce from the nonce endpoint',
  });

export const identityTokenRequestSchema = z
  .object({ idToken: idTokenSchema })
  .meta({ id: 'IdentityTokenRequest' });

export type IdentityTokenRequest = z.infer<typeof identityTokenRequestSchema>;
