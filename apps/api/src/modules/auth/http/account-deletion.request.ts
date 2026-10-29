import { z } from 'zod';
import type { DeletionConfirmation } from '../domain/account-deletion.js';
import { currentPasswordSchema } from './credentials.request.js';
import { idTokenSchema } from './identity-token.request.js';

const passwordConfirmationSchema = z
  .strictObject({
    password: currentPasswordSchema.meta({ description: 'The current password of the account' }),
  })
  .meta({ id: 'PasswordDeletionConfirmation' });

const identityConfirmationSchema = z
  .strictObject({
    provider: z.literal('google'),
    idToken: idTokenSchema.meta({
      description:
        'A fresh ID token of a Google account linked to this account, issued with a nonce from POST /v1/auth/google/nonce',
    }),
  })
  .meta({ id: 'IdentityDeletionConfirmation' });

export const accountDeletionRequestSchema = z
  .union([passwordConfirmationSchema, identityConfirmationSchema], {
    error: 'Send either { password } or { provider: "google", idToken }, nothing else',
  })
  .meta({ id: 'AccountDeletionRequest' });

export type AccountDeletionRequest = z.infer<typeof accountDeletionRequestSchema>;

export function toDeletionConfirmation(request: AccountDeletionRequest): DeletionConfirmation {
  if ('password' in request) {
    return { kind: 'password', password: request.password };
  }

  return { kind: 'identity', provider: request.provider, idToken: request.idToken };
}
