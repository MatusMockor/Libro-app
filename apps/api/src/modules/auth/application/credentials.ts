import { normaliseEmail } from '../domain/email.js';
import { normalisePassword } from '../domain/password.js';

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

export function normaliseCredentials({ email, password }: Credentials): Credentials {
  return { email: normaliseEmail(email), password: normalisePassword(password) };
}
