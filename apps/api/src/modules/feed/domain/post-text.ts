export const POST_TEXT_MAX_LENGTH = 2000;

export const PLACE_MAX_LENGTH = 100;

export function normaliseText(text: string): string {
  return text.normalize('NFC').trim();
}

export function codePointLength(text: string): number {
  return Array.from(text).length;
}

export function blankToNull(text: string | null | undefined): string | null {
  return text === undefined || text === null || text === '' ? null : text;
}
