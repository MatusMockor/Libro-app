import { Controller, Get, Inject, Param, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../../../http/authentication/public.decorator.js';
import { FILE_STORAGE, type FileStorage } from '../../application/file-storage.js';
import { STORED_MEDIA_KEYS, type StoredMediaKeys } from '../../application/stored-media-keys.js';
import { MEDIA_CONTENT_TYPE } from '../../domain/storage-key.js';
import { InvalidMediaSignatureException } from './invalid-media-signature.exception.js';
import { LOCAL_MEDIA_FILES_ROUTE } from './local-media-urls.js';
import { MediaFileNotFoundException } from './media-file-not-found.exception.js';
import {
  mediaFileParamsSchema,
  mediaFileQuerySchema,
  type MediaFileParams,
  type MediaFileQuery,
} from './media-file.request.js';
import { MediaUrlSignature } from './media-url-signature.js';

const MILLISECONDS_PER_SECOND = 1000;

@ApiTags('media')
@Controller(LOCAL_MEDIA_FILES_ROUTE)
export class LocalMediaFilesController {
  constructor(
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly signature: MediaUrlSignature,
    @Inject(STORED_MEDIA_KEYS) private readonly storedKeys: StoredMediaKeys,
  ) {}

  @Get('*key')
  @Public()
  @ApiProduces(MEDIA_CONTENT_TYPE)
  @ApiOkResponse({
    description:
      'The media file behind a signed URL from a media response; the signature is the authorisation. An invalid or expired signature answers 403 invalid_media_signature, a missing file or one of deleted media (also while its file deletion is still pending) 404 media_file_not_found',
    content: { [MEDIA_CONTENT_TYPE]: { schema: { type: 'string', format: 'binary' } } },
  })
  async file(
    @Param({ schema: mediaFileParamsSchema }) { key }: MediaFileParams,
    @Query({ schema: mediaFileQuerySchema }) { expires, signature }: MediaFileQuery,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const now = Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
    if (!this.signature.isValid(key, expires, signature, now)) {
      throw new InvalidMediaSignatureException();
    }

    if (!(await this.storedKeys.isStored(key))) {
      throw new MediaFileNotFoundException();
    }

    const file = await this.storage.read(key);
    if (!file) {
      throw new MediaFileNotFoundException();
    }

    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', `private, max-age=${String(Number(expires) - now)}`);

    return new StreamableFile(file.body, { type: file.contentType, length: file.byteSize });
  }
}
