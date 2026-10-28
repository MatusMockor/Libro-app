import { PERMILLE } from './limits.ts';

export function toNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.floor(value);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function scale(value: number, permille: number): number {
  return Math.floor((value * permille) / PERMILLE);
}

export function saturate(value: number, half: number): number {
  return Math.floor((PERMILLE * value) / (value + half));
}
