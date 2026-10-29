import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class MediaLimitReachedException extends ProblemException {
  constructor(limit: number) {
    super({
      status: HttpStatus.CONFLICT,
      code: 'media_limit_reached',
      detail: `A user can keep at most ${String(limit)} media files; delete some before uploading more.`,
    });
  }
}
