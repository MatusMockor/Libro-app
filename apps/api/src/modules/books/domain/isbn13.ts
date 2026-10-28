export const ISBN13_PATTERN = /^\d{13}$/;

export function isbn13CheckDigit(firstTwelveDigits: string): string {
  const sum = Array.from(firstTwelveDigits, Number).reduce(
    (total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3),
    0,
  );

  return String((10 - (sum % 10)) % 10);
}

export function isValidIsbn13(value: string): boolean {
  return ISBN13_PATTERN.test(value) && isbn13CheckDigit(value.slice(0, 12)) === value.slice(12);
}
