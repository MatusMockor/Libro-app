const MILLISECONDS_PER_SECOND = 1_000;

export const SESSION_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

export function sessionExpiry(startedAt: Date): Date {
  return new Date(startedAt.getTime() + SESSION_LIFETIME_SECONDS * MILLISECONDS_PER_SECOND);
}

export function secondsUntil(moment: Date, now: Date): number {
  return Math.max(0, Math.floor((moment.getTime() - now.getTime()) / MILLISECONDS_PER_SECOND));
}
