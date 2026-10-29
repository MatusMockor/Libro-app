import { z } from 'zod';
import {
  HANDLE_MAX_LENGTH,
  HANDLE_MIN_LENGTH,
  HANDLE_PATTERN,
  normaliseHandle,
} from '../domain/handle.js';
import { codePointLength, normaliseProfileText } from '../domain/profile-text.js';

export const uuidSchema = z.uuid().overwrite((id) => id.toLowerCase());

export const handleSchema = z
  .string()
  .overwrite(normaliseHandle)
  .min(HANDLE_MIN_LENGTH)
  .max(HANDLE_MAX_LENGTH)
  .regex(HANDLE_PATTERN, {
    error:
      'Must be lower case letters a-z and digits, joined by single dots or underscores, without one at the start or end',
  })
  .meta({
    description: `${String(HANDLE_MIN_LENGTH)} to ${String(HANDLE_MAX_LENGTH)} characters: letters a-z and digits, joined by single dots or underscores; surrounding spaces are ignored and upper case is lowered`,
    example: 'jana.novakova',
  });

export function profileTextSchema(maxLength: number, description: string) {
  return z
    .string()
    .overwrite(normaliseProfileText)
    .check((context) => {
      if (codePointLength(context.value) <= maxLength) {
        return;
      }

      context.issues.push({
        code: 'too_big',
        origin: 'string',
        maximum: maxLength,
        inclusive: true,
        input: context.value,
        message: `Too big: expected string to have <=${String(maxLength)} characters`,
      });
    })
    .meta({ description, maxLength });
}

export function distinct(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}
