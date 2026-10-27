import { HttpException } from '@nestjs/common';
import { problem, type Problem, type ProblemInit } from './problem.js';

export class ProblemException extends HttpException {
  readonly problem: Problem;

  constructor(init: ProblemInit) {
    const details = problem(init);
    super(details, details.status);
    this.problem = details;
    this.message = details.detail;
  }
}
