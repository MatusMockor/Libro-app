export const EMAIL_MAX_LENGTH = 254;

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}
