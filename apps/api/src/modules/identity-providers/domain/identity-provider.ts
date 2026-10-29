export const IDENTITY_PROVIDERS = ['google'] as const;

export type IdentityProvider = (typeof IDENTITY_PROVIDERS)[number];
