import type { EncouragementKind } from './encouragement.js';

export function decorationIdOf(kind: EncouragementKind, entryId: string): string {
  return `${kind}:${entryId}`;
}
