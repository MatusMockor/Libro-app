import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { finalize, type Observable } from 'rxjs';
import { authenticatedUserOf } from '../../../http/authentication/authenticated-request.js';
import { MediaUploadBusyException } from '../application/media-upload-busy.exception.js';
import { UPLOAD_ADMISSION, type UploadAdmission } from '../application/upload-admission.js';

@Injectable()
export class MediaUploadAdmissionInterceptor implements NestInterceptor {
  constructor(@Inject(UPLOAD_ADMISSION) private readonly admission: UploadAdmission) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<IncomingMessage>();
    const user = authenticatedUserOf(request);
    if (!user) {
      throw new Error('Media uploads need an authenticated route; remove @Public() from it.');
    }

    const permit = this.admission.admit(user.id);
    if (!permit) {
      throw new MediaUploadBusyException();
    }

    http.getResponse<ServerResponse>().once('close', () => {
      if (!request.complete) {
        permit.release();
      }
    });

    return next.handle().pipe(
      finalize(() => {
        permit.release();
      }),
    );
  }
}
