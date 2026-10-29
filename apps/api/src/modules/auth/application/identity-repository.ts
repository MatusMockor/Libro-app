import type { IdentityLink, IdentityLinkResult, ProviderIdentity } from '../domain/identity.js';
import type { User } from '../domain/user.js';

export const IDENTITY_REPOSITORY = Symbol('IDENTITY_REPOSITORY');

export interface IdentityRepository {
  findUser(identity: ProviderIdentity): Promise<User | undefined>;
  link(link: IdentityLink): Promise<IdentityLinkResult>;
}
