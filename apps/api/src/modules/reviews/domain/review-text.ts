export function normaliseReviewText(text: string): string {
  return text.normalize('NFC').trim();
}

export function codePointLength(text: string): number {
  return Array.from(text).length;
}

export function blankToNull(text: string | null | undefined): string | null {
  return text ? text : null;
}
