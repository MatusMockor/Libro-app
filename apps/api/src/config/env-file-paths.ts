import { resolve } from 'node:path';

export const WORKSPACE_ROOT = resolve(import.meta.dirname, '../../../..');

export function envFilePaths(nodeEnv: string | undefined, directory: string): string[] {
  const files = nodeEnv === 'test' ? ['.env.test'] : ['.env.local', '.env'];

  return files.map((file) => resolve(directory, file));
}
