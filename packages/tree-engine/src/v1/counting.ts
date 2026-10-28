import {
  HALF_SESSION_VIGOUR_SECONDS,
  MAX_PAGE,
  MAX_PARTS_PER_KIND_PER_SESSION,
  MAX_SPAN_BONUS,
  MIN_COUNTED_CHECKPOINTS,
  MIN_COUNTED_SECONDS,
  PAGES_PER_SPAN_BONUS,
  SESSION_SECONDS_CAP,
} from './limits.ts';
import { saturate, toNonNegativeInteger } from './numbers.ts';
import type { MarkedPartInputV1, MarkedPartKind, SessionInputV1 } from './types.ts';

export interface CountedPart {
  readonly spanBonus: number;
}

export interface CountedSession {
  readonly index: number;
  readonly seconds: number;
  readonly vigour: number;
  readonly good: readonly CountedPart[];
  readonly slow: readonly CountedPart[];
  readonly skipped: readonly CountedPart[];
}

export interface SessionCount {
  readonly counted: readonly CountedSession[];
  readonly ignored: number;
  readonly countedSeconds: number;
}

function isCountedSession(session: SessionInputV1): boolean {
  return (
    toNonNegativeInteger(session.activeSeconds) >= MIN_COUNTED_SECONDS &&
    session.checkpoints.length >= MIN_COUNTED_CHECKPOINTS
  );
}

export function countSessions(sessions: readonly SessionInputV1[]): SessionCount {
  const counted = sessions.filter(isCountedSession).map(toCountedSession);

  return {
    counted,
    ignored: sessions.length - counted.length,
    countedSeconds: counted.reduce((total, session) => total + session.seconds, 0),
  };
}

function toCountedSession(session: SessionInputV1, index: number): CountedSession {
  const seconds = Math.min(toNonNegativeInteger(session.activeSeconds), SESSION_SECONDS_CAP);

  return {
    index,
    seconds,
    vigour: saturate(seconds, HALF_SESSION_VIGOUR_SECONDS),
    good: firstPartsOfKind(session.markedParts, 'good'),
    slow: firstPartsOfKind(session.markedParts, 'slow'),
    skipped: firstPartsOfKind(session.markedParts, 'skipped'),
  };
}

function firstPartsOfKind(
  parts: readonly MarkedPartInputV1[],
  kind: MarkedPartKind,
): CountedPart[] {
  const found: CountedPart[] = [];

  for (const part of parts) {
    if (found.length >= MAX_PARTS_PER_KIND_PER_SESSION) {
      return found;
    }

    if (part.kind === kind) {
      found.push(toCountedPart(part));
    }
  }

  return found;
}

function toCountedPart(part: MarkedPartInputV1): CountedPart {
  const from = Math.min(toNonNegativeInteger(part.fromPage), MAX_PAGE);
  const to = Math.min(toNonNegativeInteger(part.toPage), MAX_PAGE);
  const span = Math.abs(to - from) + 1;

  return {
    spanBonus: Math.min(Math.floor(span / PAGES_PER_SPAN_BONUS), MAX_SPAN_BONUS),
  };
}
