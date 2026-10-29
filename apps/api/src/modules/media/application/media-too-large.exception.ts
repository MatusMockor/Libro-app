import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

const BYTES_PER_MIB = 1024 * 1024;

export class MediaTooLargeException extends ProblemException {
  constructor(maxBytes: number) {
    super({
      status: HttpStatus.PAYLOAD_TOO_LARGE,
      code: 'media_too_large',
      detail: `The file must be at most ${String(maxBytes / BYTES_PER_MIB)} MiB.`,
    });
  }
}
