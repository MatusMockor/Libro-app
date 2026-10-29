import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

const RETRY_AFTER_SECONDS = 1;

export class MediaUploadBusyException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.TOO_MANY_REQUESTS,
      code: 'media_upload_busy',
      detail: 'Too many uploads are in progress; retry shortly, one upload per user at a time.',
      headers: { 'Retry-After': String(RETRY_AFTER_SECONDS) },
    });
  }
}
