import { z } from 'zod';
import type { SignInNonce } from '../application/sign-in-nonce.js';

export const signInNonceSchema = z
  .object({
    nonce: z.string().meta({
      description: 'Pass it to the provider sign-in on the device; usable for one sign-in only',
    }),
    expiresIn: z.int().meta({ description: 'Seconds until the nonce expires' }),
  })
  .meta({ id: 'SignInNonce' });

export type SignInNonceResponse = z.infer<typeof signInNonceSchema>;

export function toSignInNonceResponse({ value, expiresIn }: SignInNonce): SignInNonceResponse {
  return { nonce: value, expiresIn };
}
