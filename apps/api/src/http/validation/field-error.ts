import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { FieldError } from '../problem-details/problem-details.schema.js';

const UNKNOWN_ISSUE_CODE = 'invalid';

export function toFieldError(issue: StandardSchemaV1.Issue): FieldError {
  return {
    path: (issue.path ?? []).map(segmentKey).join('.'),
    message: issue.message,
    code: issueCode(issue),
  };
}

function segmentKey(segment: PropertyKey | StandardSchemaV1.PathSegment): string {
  return String(typeof segment === 'object' ? segment.key : segment);
}

function issueCode(issue: StandardSchemaV1.Issue): string {
  if ('code' in issue && typeof issue.code === 'string') {
    return issue.code;
  }

  return UNKNOWN_ISSUE_CODE;
}
