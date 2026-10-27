import type { Problem } from './problem.js';

export const PROBLEM_MAPPERS = Symbol('PROBLEM_MAPPERS');

export interface ProblemMapper {
  toProblem(exception: unknown): Problem | undefined;
}
