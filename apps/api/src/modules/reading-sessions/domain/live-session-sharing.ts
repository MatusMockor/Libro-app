export const LIVE_SESSION_SHARINGS = ['followers', 'nobody'] as const;

export type LiveSessionSharing = (typeof LIVE_SESSION_SHARINGS)[number];

export const SHARED_WITH_FOLLOWERS: LiveSessionSharing = 'followers';

export const DEFAULT_LIVE_SESSION_SHARING: LiveSessionSharing = SHARED_WITH_FOLLOWERS;
