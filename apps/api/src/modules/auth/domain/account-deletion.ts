import type { IdentityProvider } from '../../identity-providers/index.js';

export const DELETED_ACCOUNT_RETENTION_DAYS = 30;

const MILLISECONDS_PER_MINUTE = 60_000;

export const DELETION_REPLAY_DELAYS_MS: readonly number[] = [
  2 * MILLISECONDS_PER_MINUTE,
  10 * MILLISECONDS_PER_MINUTE,
];

export type DeletionConfirmation =
  | { readonly kind: 'password'; readonly password: string }
  | { readonly kind: 'identity'; readonly provider: IdentityProvider; readonly idToken: string };
