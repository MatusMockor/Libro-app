import { isbn13CheckDigit } from '../domain/isbn13.js';

const SYNTHETIC_ISBN13_PREFIX = '9790';
const SEQUENCE_DIGITS = 8;

export function syntheticIsbn13(sequence: number): string {
  const firstTwelveDigits = `${SYNTHETIC_ISBN13_PREFIX}${String(sequence).padStart(SEQUENCE_DIGITS, '0')}`;

  return `${firstTwelveDigits}${isbn13CheckDigit(firstTwelveDigits)}`;
}
