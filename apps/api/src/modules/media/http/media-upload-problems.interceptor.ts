import type { IncomingMessage } from 'node:http';
import {
  BadRequestException,
  HttpException,
  Injectable,
  PayloadTooLargeException,
  UnsupportedMediaTypeException as NestUnsupportedMediaTypeException,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { catchError, throwError, type Observable } from 'rxjs';
import { RequestValidationException } from '../../../http/problem-details/request-validation.exception.js';
import { MediaTooLargeException } from '../application/media-too-large.exception.js';
import { UnsupportedMediaTypeException } from '../application/unsupported-media-type.exception.js';
import { MAX_UPLOAD_BYTES } from '../domain/media-limits.js';
import { MEDIA_UPLOAD_FIELD } from './media-upload.options.js';

@Injectable()
export class MediaUploadProblemsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<IncomingMessage>();

    return next
      .handle()
      .pipe(catchError((error: unknown) => throwError(() => toProblem(error, request))));
  }
}

function toProblem(error: unknown, request: IncomingMessage): unknown {
  if (request.readableAborted && !(error instanceof HttpException)) {
    return new RequestValidationException([
      {
        path: MEDIA_UPLOAD_FIELD,
        message: 'The upload was aborted before the file was complete',
        code: 'aborted',
      },
    ]);
  }

  if (error instanceof PayloadTooLargeException) {
    return new MediaTooLargeException(MAX_UPLOAD_BYTES);
  }

  if (error instanceof NestUnsupportedMediaTypeException) {
    return new UnsupportedMediaTypeException();
  }

  if (error instanceof BadRequestException) {
    return new RequestValidationException([
      { path: MEDIA_UPLOAD_FIELD, message: error.message, code: 'invalid_multipart' },
    ]);
  }

  return error;
}
