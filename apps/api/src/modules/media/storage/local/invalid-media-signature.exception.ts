import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../../http/problem-details/problem.exception.js';

export class InvalidMediaSignatureException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.FORBIDDEN,
      code: 'invalid_media_signature',
      detail: 'The media URL is invalid or has expired; request the media again for a fresh URL.',
    });
  }
}
