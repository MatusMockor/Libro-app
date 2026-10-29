import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Env } from '../../../../config/env.schema.js';
import { FILE_STORAGE } from '../../application/file-storage.js';
import { STORED_MEDIA_KEYS } from '../../application/stored-media-keys.js';
import { MediaFileVariantEntity } from '../../persistence/media-file-variant.entity.js';
import { TypeOrmStoredMediaKeyRepository } from '../../persistence/typeorm-stored-media-key.repository.js';
import { LocalDiskStorage } from './local-disk.storage.js';
import { LocalMediaFilesController } from './local-media-files.controller.js';
import { LocalMediaUrls } from './local-media-urls.js';
import { MediaUrlSignature } from './media-url-signature.js';

function mediaUrlSignature(config: ConfigService<Env, true>): MediaUrlSignature {
  return new MediaUrlSignature(config.get('MEDIA_URL_SIGNING_SECRET', { infer: true }));
}

function localDiskStorage(
  config: ConfigService<Env, true>,
  signature: MediaUrlSignature,
): LocalDiskStorage {
  const urls = new LocalMediaUrls(config.get('PUBLIC_API_URL', { infer: true }), signature);

  return new LocalDiskStorage(config.get('MEDIA_LOCAL_ROOT', { infer: true }), urls);
}

@Module({
  imports: [TypeOrmModule.forFeature([MediaFileVariantEntity])],
  controllers: [LocalMediaFilesController],
  providers: [
    { provide: STORED_MEDIA_KEYS, useClass: TypeOrmStoredMediaKeyRepository },
    { provide: MediaUrlSignature, inject: [ConfigService], useFactory: mediaUrlSignature },
    {
      provide: FILE_STORAGE,
      inject: [ConfigService, MediaUrlSignature],
      useFactory: localDiskStorage,
    },
  ],
  exports: [FILE_STORAGE],
})
export class LocalDiskStorageModule {}
