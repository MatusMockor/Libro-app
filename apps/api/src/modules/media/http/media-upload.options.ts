import type { MulterModuleOptions } from '@nestjs/platform-express';
import { MAX_UPLOAD_BYTES } from '../domain/media-limits.js';

export const MEDIA_UPLOAD_FIELD = 'file';

export const MEDIA_UPLOAD_OPTIONS: MulterModuleOptions = {
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0, parts: 1 },
};
