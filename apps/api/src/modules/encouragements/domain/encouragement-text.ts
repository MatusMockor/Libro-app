export function normaliseEncouragementText(text: string): string {
  return text.normalize('NFC').trim();
}

export function codePointLength(text: string): number {
  return Array.from(text).length;
}
