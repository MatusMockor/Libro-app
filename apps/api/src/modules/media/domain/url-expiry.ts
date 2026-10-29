import { MEDIA_URL_TTL_SECONDS } from './media-limits.js';

const MILLISECONDS_PER_SECOND = 1000;

export function urlsExpiry(now: Date): Date {
  const nowSeconds = Math.floor(now.getTime() / MILLISECONDS_PER_SECOND);

  return new Date((nowSeconds + MEDIA_URL_TTL_SECONDS) * MILLISECONDS_PER_SECOND);
}
