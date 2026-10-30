import { z } from 'zod';
import { codePointLength, normaliseText } from '../domain/post-text.js';

export const uuidSchema = z.uuid().overwrite((id) => id.toLowerCase());

export function codePointTextSchema(maxLength: number) {
  return z
    .string()
    .overwrite(normaliseText)
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
    });
}
