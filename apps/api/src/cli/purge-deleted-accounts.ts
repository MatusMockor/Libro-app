import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { DELETED_ACCOUNTS_PURGE, type DeletedAccountsPurge } from '../modules/auth/index.js';
import { MEDIA_FILE_DELETIONS, type MediaFileDeletions } from '../modules/media/index.js';
import { purgeDeletedAccounts } from './deleted-accounts-purge.js';

const logger = new Logger('PurgeDeletedAccounts');

const app = await NestFactory.createApplicationContext(AppModule);

try {
  const report = await purgeDeletedAccounts({
    accounts: app.get<DeletedAccountsPurge>(DELETED_ACCOUNTS_PURGE),
    mediaFiles: app.get<MediaFileDeletions>(MEDIA_FILE_DELETIONS),
  });
  logger.log(
    `Published UserDeleted again for ${String(report.replayed)} deleted accounts, deleted ${String(report.mediaFilesDeleted)} pending media files, forgot ${String(report.forgotten)} expired tombstones`,
  );
  if (report.mediaFilesFailed > 0) {
    logger.error(
      `${String(report.mediaFilesFailed)} pending media file deletions failed again and stay pending`,
    );
    process.exitCode = 1;
  }
} finally {
  await app.close();
}
