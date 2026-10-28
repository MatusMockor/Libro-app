import { STATUS_CODES } from 'node:http';
import type { FieldError, ProblemDetails } from './problem-details.schema.js';

export type ProblemHeaders = Readonly<Record<string, string>>;

export type Problem = Omit<ProblemDetails, 'instance'> & { readonly headers?: ProblemHeaders };

export interface ProblemInit {
  status: number;
  code: string;
  detail: string;
  errors?: FieldError[];
  headers?: ProblemHeaders;
}

export function problem({ status, code, detail, errors, headers }: ProblemInit): Problem {
  const base = {
    type: 'about:blank',
    title: STATUS_CODES[status] ?? 'Error',
    status,
    detail,
    code,
  };

  return { ...base, ...(errors && { errors }), ...(headers && { headers }) };
}

export function isServerError(status: number): boolean {
  return status >= 500;
}

export function statusPhrase(status: number): string {
  return STATUS_CODES[status] ?? `HTTP ${String(status)}`;
}
