import type {
  DecorationInputV1,
  DecorationKind,
  MarkedPartInputV1,
  MarkedPartKind,
  SessionInputV1,
  TreeInputV1,
} from '../../src/index.ts';

export const MINUTE = 60;
export const HOUR = 60 * MINUTE;

export function part(kind: MarkedPartKind, fromPage: number, toPage: number): MarkedPartInputV1 {
  return { kind, fromPage, toPage };
}

export function session(
  seconds: number,
  markedParts: readonly MarkedPartInputV1[] = [],
  checkpointCount = 1,
): SessionInputV1 {
  return {
    activeSeconds: seconds,
    checkpoints: Array.from({ length: checkpointCount }, (_, index) => ({ page: 10 + index })),
    markedParts,
  };
}

export function sessions(
  count: number,
  seconds: number,
  partsAt: (index: number) => readonly MarkedPartInputV1[] = () => [],
): SessionInputV1[] {
  return Array.from({ length: count }, (_, index) => session(seconds, partsAt(index)));
}

export function decoration(id: string, kind: DecorationKind = 'insight'): DecorationInputV1 {
  return { id, kind };
}

export function reading(overrides: Partial<TreeInputV1> = {}): TreeInputV1 {
  return { seed: 'reading-1', finished: false, sessions: [], decorations: [], ...overrides };
}

export function withoutParts(input: TreeInputV1, kind: MarkedPartKind): TreeInputV1 {
  return {
    ...input,
    sessions: input.sessions.map((entry) => ({
      ...entry,
      markedParts: entry.markedParts.filter((marked) => marked.kind !== kind),
    })),
  };
}
