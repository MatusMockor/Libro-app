import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class MediaNotFoundException extends ProblemException {
  constructor(mediaId: string) {
    super({
      status: HttpStatus.NOT_FOUND,
      code: 'media_not_found',
      detail: `No media with id ${mediaId} was found.`,
    });
  }
}
