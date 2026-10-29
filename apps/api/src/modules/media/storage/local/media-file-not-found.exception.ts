import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../../http/problem-details/problem.exception.js';

export class MediaFileNotFoundException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.NOT_FOUND,
      code: 'media_file_not_found',
      detail: 'The media file does not exist.',
    });
  }
}
