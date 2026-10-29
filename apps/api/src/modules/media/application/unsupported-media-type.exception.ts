import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class UnsupportedMediaTypeException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      code: 'unsupported_media_type',
      detail: 'The file must be a JPEG, PNG or WebP image.',
    });
  }
}
