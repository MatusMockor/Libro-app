import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';
import type { PostLimit } from '../domain/post-limit.js';

const SECONDS_PER_HOUR = 3600;

export class PostLimitReachedException extends ProblemException {
  constructor({ posts, windowSeconds }: PostLimit, retryAfterSeconds: number) {
    super({
      status: HttpStatus.TOO_MANY_REQUESTS,
      code: 'post_limit_reached',
      detail: `A reader can publish at most ${String(posts)} posts in ${String(windowSeconds / SECONDS_PER_HOUR)} hours; try again later.`,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    });
  }
}
