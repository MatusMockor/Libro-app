import { isIP } from 'node:net';

export type TrustProxy = number | readonly string[];

const HOP_COUNT = /^\d+$/;
const NAMED_RANGES = ['loopback', 'linklocal', 'uniquelocal'];
const PREFIX = /^\d{1,3}$/;
const MAX_PREFIX: Readonly<Record<number, number>> = { 4: 32, 6: 128 };

export function parseTrustProxy(value: string): TrustProxy | undefined {
  if (HOP_COUNT.test(value)) {
    const hops = Number(value);

    return Number.isSafeInteger(hops) ? hops : undefined;
  }

  const proxies = value.split(',').map((proxy) => proxy.trim());

  return proxies.every(isTrustedProxy) ? proxies : undefined;
}

function isTrustedProxy(proxy: string): boolean {
  return NAMED_RANGES.includes(proxy) || isIP(proxy) !== 0 || isCidr(proxy);
}

function isCidr(proxy: string): boolean {
  const [address = '', prefix = '', ...rest] = proxy.split('/');
  const maxPrefix = MAX_PREFIX[isIP(address)];

  if (rest.length > 0 || maxPrefix === undefined || !PREFIX.test(prefix)) {
    return false;
  }

  return Number(prefix) >= 1 && Number(prefix) <= maxPrefix;
}
