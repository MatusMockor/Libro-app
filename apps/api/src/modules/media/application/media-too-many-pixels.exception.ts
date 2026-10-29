import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class MediaTooManyPixelsException extends ProblemException {
  constructor(maxPixels: number) {
    super({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      code: 'media_too_many_pixels',
      detail: `The image must have at most ${String(maxPixels)} pixels.`,
    });
  }
}
