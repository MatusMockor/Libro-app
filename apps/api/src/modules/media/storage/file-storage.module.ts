import { Module, type DynamicModule, type Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { mediaStorageDriverSchema } from '../../../config/env.schema.js';
import type { MediaStorageDriver } from '../../../config/media-storage-driver.js';
import { LocalDiskStorageModule } from './local/local-disk-storage.module.js';

const STORAGE_MODULES: Readonly<Record<MediaStorageDriver, Type>> = {
  local: LocalDiskStorageModule,
};

@Module({})
export class FileStorageModule {
  static async forConfiguredDriver(): Promise<DynamicModule> {
    await ConfigModule.envVariablesLoaded;
    const storage =
      STORAGE_MODULES[mediaStorageDriverSchema.parse(process.env.MEDIA_STORAGE_DRIVER)];

    return { module: FileStorageModule, imports: [storage], exports: [storage] };
  }
}
