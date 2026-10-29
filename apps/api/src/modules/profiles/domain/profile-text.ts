export const DISPLAY_NAME_MAX_LENGTH = 50;

export const BIO_MAX_LENGTH = 300;

export function normaliseProfileText(text: string): string {
  return text.normalize('NFC').trim();
}

export function codePointLength(text: string): number {
  return Array.from(text).length;
}

export function blankToNull(text: string | null | undefined): string | null | undefined {
  return text === '' ? null : text;
}
