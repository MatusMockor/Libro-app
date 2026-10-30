import { z } from 'zod';
import type { EncouragementCursor } from '../domain/encouragement-page.js';

const BASE64URL = /^[A-Za-z0-9_-]+$/;

const CURSOR_TIME = /^[2-9]\d{3}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

const DECORATION_ID =
  /^(insight|congratulation):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const MILLISECOND_TIME_LENGTH = 23;

const cursorSchema = z.strictObject({
  createdAt: z.string().regex(CURSOR_TIME).refine(isCalendarTime),
  decorationId: z.string().regex(DECORATION_ID),
});

export function encodeCursor(cursor: EncouragementCursor | null): string | null {
  if (!cursor) {
    return null;
  }

  const { createdAt, decorationId } = cursor;

  return Buffer.from(JSON.stringify({ createdAt, decorationId })).toString('base64url');
}

export function decodeCursor(value: string | undefined): EncouragementCursor | null {
  if (value === undefined || !BASE64URL.test(value)) {
    return null;
  }

  const bytes = Buffer.from(value, 'base64url');
  if (bytes.toString('base64url') !== value) {
    return null;
  }

  const parsed = cursorSchema.safeParse(parseJson(bytes.toString()));

  return parsed.success ? parsed.data : null;
}

export function isCursor(value: string): boolean {
  return decodeCursor(value) !== null;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isCalendarTime(time: string): boolean {
  const milliseconds = `${time.slice(0, MILLISECOND_TIME_LENGTH)}Z`;
  const parsed = new Date(milliseconds);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === milliseconds;
}
