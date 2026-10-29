import type { StandardSchemaV1 } from '@standard-schema/spec';

const NUL = '\u0000';

export const NUL_CHARACTER_MESSAGE = 'Must not contain NUL characters (U+0000)';

export interface NulCharacterIssue extends StandardSchemaV1.Issue {
  readonly code: 'invalid_format';
}

export function nulCharacterIssues(
  value: unknown,
  path: readonly PropertyKey[] = [],
): NulCharacterIssue[] {
  if (typeof value === 'string') {
    return value.includes(NUL)
      ? [{ message: NUL_CHARACTER_MESSAGE, path, code: 'invalid_format' }]
      : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item: unknown, index) => nulCharacterIssues(item, [...path, index]));
  }

  if (!isPlainObject(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, item]) => nulCharacterIssues(item, [...path, key]));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype: unknown = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}
