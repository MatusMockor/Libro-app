export const HANDLE_MIN_LENGTH = 3;

export const HANDLE_MAX_LENGTH = 30;

export const HANDLE_PATTERN = /^[a-z0-9]+(?:[._][a-z0-9]+)*$/;

export const DEFAULT_HANDLE_PREFIX = 'citatel';

export const DEFAULT_HANDLE_SUFFIX_LENGTHS = [6, 6, 6, 12, 12, 12] as const;

export function normaliseHandle(handle: string): string {
  return handle.trim().toLowerCase();
}

export function defaultHandle(suffix: string): string {
  return `${DEFAULT_HANDLE_PREFIX}${suffix}`;
}
