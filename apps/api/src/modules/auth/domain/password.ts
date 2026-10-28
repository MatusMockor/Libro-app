export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export function normalisePassword(password: string): string {
  return password.normalize('NFKC');
}

export function passwordLength(password: string): number {
  return Array.from(password).length;
}
