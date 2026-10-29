import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { DeleteMediaService } from '../application/delete-media.service.js';
import { MediaLibraryService } from '../application/media-library.service.js';
import { UploadMediaService } from '../application/upload-media.service.js';
import { mediaParamsSchema, type MediaParams } from './media-params.request.js';
import { mediaSchema, toMediaResponse, type MediaResponse } from './media.response.js';
import { MediaUploadAdmissionInterceptor } from './media-upload-admission.interceptor.js';
import { MediaUploadProblemsInterceptor } from './media-upload-problems.interceptor.js';
import { MEDIA_UPLOAD_FIELD, MEDIA_UPLOAD_OPTIONS } from './media-upload.options.js';
import { uploadedImagePipe, type UploadedImage } from './uploaded-image.pipe.js';

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(
    private readonly uploads: UploadMediaService,
    private readonly library: MediaLibraryService,
    private readonly deletion: DeleteMediaService,
  ) {}

  @Post()
  @UseInterceptors(
    MediaUploadAdmissionInterceptor,
    MediaUploadProblemsInterceptor,
    FileInterceptor(MEDIA_UPLOAD_FIELD, MEDIA_UPLOAD_OPTIONS),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [MEDIA_UPLOAD_FIELD],
      properties: {
        [MEDIA_UPLOAD_FIELD]: {
          type: 'string',
          format: 'binary',
          description: 'A JPEG, PNG or WebP image of at most 10 MiB and 50 megapixels',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      'The photo was stored as WebP variants without metadata (EXIF, GPS, XMP). A missing file answers 400 validation_failed, a file over 10 MiB 413 media_too_large, anything but JPEG, PNG or WebP 415 unsupported_media_type, over 50 megapixels 422 media_too_many_pixels, 500 stored media 409 media_limit_reached, an upload of the same user still running or too many uploads at once 429 media_upload_busy (Retry-After)',
    standardSchema: mediaSchema,
  })
  async upload(
    @CurrentUser() { id }: AuthenticatedUser,
    @UploadedFile(uploadedImagePipe()) { buffer }: UploadedImage,
  ): Promise<MediaResponse> {
    return toMediaResponse(await this.uploads.upload(id, buffer));
  }

  @Get(':mediaId')
  @ApiOkResponse({
    description:
      'The media with freshly signed variant URLs. Unknown media or media of another user answers 404 media_not_found',
    standardSchema: mediaSchema,
  })
  async find(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: mediaParamsSchema }) { mediaId }: MediaParams,
  ): Promise<MediaResponse> {
    return toMediaResponse(await this.library.getOwned(id, mediaId));
  }

  @Delete(':mediaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description:
      'The media and its files are deleted. Unknown media or media of another user answers 404 media_not_found',
  })
  async delete(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: mediaParamsSchema }) { mediaId }: MediaParams,
  ): Promise<void> {
    await this.deletion.delete(id, mediaId);
  }
}
