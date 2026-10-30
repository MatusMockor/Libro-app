import { z } from 'zod';
import type { FeedCursor } from '../domain/feed-page.js';

const BASE64URL = /^[A-Za-z0-9_-]+$/;

const CURSOR_TIME = /^[2-9]\d{3}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

const MILLISECOND_TIME_LENGTH = 23;

const cursorSchema = z.strictObject({
  createdAt: z.string().regex(CURSOR_TIME).refine(isCalendarTime),
  id: z.uuid(),
});

export function encodeCursor(cursor: FeedCursor | null): string | null {
  if (!cursor) {
    return null;
  }

  const { createdAt, id } = cursor;

  return Buffer.from(JSON.stringify({ createdAt, id })).toString('base64url');
}

export function decodeCursor(value: string | undefined): FeedCursor | null {
  if (value === undefined || !BASE64URL.test(value)) {
    return null;
  }

  const bytes = Buffer.from(value, 'base64url');
  if (bytes.toString('base64url') !== value) {
    return null;
  }

  const parsed = cursorSchema.safeParse(parseJson(bytes.toString()));

  return parsed.success
    ? { createdAt: parsed.data.createdAt, id: parsed.data.id.toLowerCase() }
    : null;
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
