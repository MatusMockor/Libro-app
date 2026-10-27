import { STATUS_CODES } from 'node:http';
import type { FieldError, ProblemDetails } from './problem-details.schema.js';

export type Problem = Omit<ProblemDetails, 'instance'>;

export interface ProblemInit {
  status: number;
  code: string;
  detail: string;
  errors?: FieldError[];
}

export function problem({ status, code, detail, errors }: ProblemInit): Problem {
  const base = {
    type: 'about:blank',
    title: STATUS_CODES[status] ?? 'Error',
    status,
    detail,
    code,
  };

  return errors ? { ...base, errors } : base;
}

export function isServerError(status: number): boolean {
  return status >= 500;
}
