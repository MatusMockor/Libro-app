import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';
import { MAX_INSIGHTS_PER_AUTHOR_AND_READING } from '../domain/insight.js';

export class InsightLimitReachedException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.CONFLICT,
      code: 'insight_limit_reached',
      detail: `You can add at most ${String(MAX_INSIGHTS_PER_AUTHOR_AND_READING)} insights to one reading.`,
    });
  }
}
