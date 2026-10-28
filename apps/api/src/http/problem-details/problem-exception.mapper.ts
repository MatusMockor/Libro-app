import { isServerError, problem, statusPhrase, type Problem } from './problem.js';
import { ProblemException } from './problem.exception.js';
import type { ProblemMapper } from './problem-mapper.js';

export class ProblemExceptionMapper implements ProblemMapper {
  toProblem(exception: unknown): Problem | undefined {
    if (!(exception instanceof ProblemException)) {
      return undefined;
    }

    return publicProblem(exception.problem);
  }
}

function publicProblem(details: Problem): Problem {
  if (!isServerError(details.status)) {
    return details;
  }

  return problem({
    status: details.status,
    code: details.code,
    detail: statusPhrase(details.status),
    ...(details.headers && { headers: details.headers }),
  });
}
