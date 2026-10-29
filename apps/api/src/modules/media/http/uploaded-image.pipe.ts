import { ParseFilePipe } from '@nestjs/common';
import { RequestValidationException } from '../../../http/problem-details/request-validation.exception.js';
import { MEDIA_UPLOAD_FIELD } from './media-upload.options.js';

export interface UploadedImage {
  readonly buffer: Buffer;
}

export function uploadedImagePipe(): ParseFilePipe {
  return new ParseFilePipe({
    fileIsRequired: true,
    exceptionFactory: () =>
      new RequestValidationException([
        {
          path: MEDIA_UPLOAD_FIELD,
          message: 'Expected an image file in the multipart field "file"',
          code: 'invalid_type',
        },
      ]),
  });
}
