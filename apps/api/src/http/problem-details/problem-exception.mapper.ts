import type { Problem } from './problem.js';
import { ProblemException } from './problem.exception.js';
import type { ProblemMapper } from './problem-mapper.js';

export class ProblemExceptionMapper implements ProblemMapper {
  toProblem(exception: unknown): Problem | undefined {
    if (!(exception instanceof ProblemException)) {
      return undefined;
    }

    return exception.problem;
  }
}
