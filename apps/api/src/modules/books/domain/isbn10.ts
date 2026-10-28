import { isbn13CheckDigit } from './isbn13.js';

const ISBN10_PATTERN = /^\d{9}[\dX]$/;
const ISBN13_PREFIX_OF_ISBN10 = '978';

export function isValidIsbn10(value: string): boolean {
  if (!ISBN10_PATTERN.test(value)) {
    return false;
  }

  const sum = Array.from(
    value,
    (character, index) => (character === 'X' ? 10 : Number(character)) * (10 - index),
  ).reduce((total, weighted) => total + weighted, 0);

  return sum % 11 === 0;
}

export function isbn13FromIsbn10(isbn10: string): string {
  const firstTwelveDigits = `${ISBN13_PREFIX_OF_ISBN10}${isbn10.slice(0, 9)}`;

  return `${firstTwelveDigits}${isbn13CheckDigit(firstTwelveDigits)}`;
}
