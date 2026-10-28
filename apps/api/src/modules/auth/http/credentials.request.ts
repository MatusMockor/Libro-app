import { z } from 'zod';
import { EMAIL_MAX_LENGTH, normaliseEmail } from '../domain/email.js';
import {
  normalisePassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordLength,
} from '../domain/password.js';

const LOGIN_PASSWORD_MAX_LENGTH = 1024;

const emailSchema = z
  .preprocess(
    (value) => (typeof value === 'string' ? normaliseEmail(value) : value),
    z.email().max(EMAIL_MAX_LENGTH),
  )
  .meta({ description: 'Compared case-insensitively, surrounding spaces are ignored' });

const newPasswordSchema = z
  .string()
  .overwrite(normalisePassword)
  .check((context) => {
    const length = passwordLength(context.value);

    if (length < PASSWORD_MIN_LENGTH) {
      context.issues.push({
        code: 'too_small',
        origin: 'string',
        minimum: PASSWORD_MIN_LENGTH,
        inclusive: true,
        input: context.value,
        message: `Too small: expected string to have >=${String(PASSWORD_MIN_LENGTH)} characters`,
      });
    }

    if (length > PASSWORD_MAX_LENGTH) {
      context.issues.push({
        code: 'too_big',
        origin: 'string',
        maximum: PASSWORD_MAX_LENGTH,
        inclusive: true,
        input: context.value,
        message: `Too big: expected string to have <=${String(PASSWORD_MAX_LENGTH)} characters`,
      });
    }
  })
  .meta({
    description: `${String(PASSWORD_MIN_LENGTH)} to ${String(PASSWORD_MAX_LENGTH)} characters (Unicode code points), no other rules`,
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  });

export const registerSchema = z
  .object({ email: emailSchema, password: newPasswordSchema })
  .meta({ id: 'Register' });

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(LOGIN_PASSWORD_MAX_LENGTH).overwrite(normalisePassword),
  })
  .meta({ id: 'Login' });

export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
