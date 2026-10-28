import type { IncomingHttpHeaders } from 'node:http';

const BEARER_CREDENTIALS = /^Bearer ([A-Za-z0-9\-._~+/]+=*)$/i;

export function bearerToken(headers: IncomingHttpHeaders): string | undefined {
  return BEARER_CREDENTIALS.exec(headers.authorization ?? '')?.[1];
}
