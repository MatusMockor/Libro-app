import type { ConfigModuleOptions } from '@nestjs/config';
import { envSchema } from './env.schema.js';

export function configModuleOptions(envFilePath: string[]): ConfigModuleOptions {
  return {
    isGlobal: true,
    cache: true,
    envFilePath,
    validationSchema: envSchema,
  };
}
