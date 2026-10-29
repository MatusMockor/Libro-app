import type { IdentityProvider } from '../../identity-providers/index.js';
import type { User } from './user.js';

export interface ProviderIdentity {
  readonly provider: IdentityProvider;
  readonly subject: string;
}

export interface IdentityLink extends ProviderIdentity {
  readonly email: string;
  readonly mayLinkExistingAccount: boolean;
}

export type IdentityLinkResult =
  | { readonly kind: 'signed_in' | 'linked' | 'created'; readonly user: User }
  | { readonly kind: 'conflict' }
  | { readonly kind: 'existing_account' };
