import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeleteMediaService } from './application/delete-media.service.js';
import { IMAGE_PROCESSOR } from './application/image-processor.js';
import { InProcessUploadAdmission } from './application/in-process-upload-admission.js';
import { MediaFileCleanupService } from './application/media-file-cleanup.service.js';
import { MediaLibraryService } from './application/media-library.service.js';
import { MEDIA_REPOSITORY } from './application/media-repository.js';
import { MediaUrlsService } from './application/media-urls.service.js';
import { UPLOAD_ADMISSION } from './application/upload-admission.js';
import { UploadMediaService } from './application/upload-media.service.js';
import { MediaController } from './http/media.controller.js';
import { MEDIA_LIBRARY } from './media-library.js';
import { MediaFileVariantEntity } from './persistence/media-file-variant.entity.js';
import { MediaFileEntity } from './persistence/media-file.entity.js';
import { TypeOrmMediaRepository } from './persistence/typeorm-media.repository.js';
import { SharpImageProcessor } from './processing/sharp-image.processor.js';
import { FileStorageModule } from './storage/file-storage.module.js';

function uploadAdmission(config: ConfigService<Env, true>): InProcessUploadAdmission {
  return new InProcessUploadAdmission(config.get('MEDIA_UPLOAD_CONCURRENCY', { infer: true }));
}

@Module({
  imports: [
    TypeOrmModule.forFeature([MediaFileEntity, MediaFileVariantEntity]),
    FileStorageModule.forConfiguredDriver(),
  ],
  controllers: [MediaController],
  providers: [
    UploadMediaService,
    DeleteMediaService,
    MediaLibraryService,
    MediaUrlsService,
    MediaFileCleanupService,
    { provide: UPLOAD_ADMISSION, inject: [ConfigService], useFactory: uploadAdmission },
    { provide: IMAGE_PROCESSOR, useClass: SharpImageProcessor },
    { provide: MEDIA_REPOSITORY, useClass: TypeOrmMediaRepository },
    { provide: MEDIA_LIBRARY, useExisting: MediaLibraryService },
  ],
  exports: [MEDIA_LIBRARY],
})
export class MediaModule {}
