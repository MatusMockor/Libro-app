import { randomUUID } from 'node:crypto';
import { constants, type Stats } from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  realpath,
  rename,
  rm,
  rmdir,
  writeFile,
  type FileHandle,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import type { FileStorage, StoredFile } from '../../application/file-storage.js';
import { isStorageKey, MEDIA_CONTENT_TYPE } from '../../domain/storage-key.js';
import type { LocalMediaUrls } from './local-media-urls.js';

const MISSING_CODES = ['ENOENT', 'ENOTDIR', 'ELOOP'];

const KEPT_DIRECTORY_CODES = ['ENOENT', 'ENOTEMPTY', 'EEXIST', 'ENOTDIR'];

const READ_WITHOUT_FOLLOWING = constants.O_RDONLY | constants.O_NOFOLLOW;

interface Location {
  readonly directory: string;
  readonly file: string;
}

export class LocalDiskStorage implements FileStorage {
  private readonly logger = new Logger(LocalDiskStorage.name);

  private readonly root: string;

  private realRoot: Promise<string> | undefined;

  constructor(
    root: string,
    private readonly urls: LocalMediaUrls,
  ) {
    this.root = resolve(root);
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    const location = locationOf(key);
    if (contentType !== MEDIA_CONTENT_TYPE) {
      throw new Error(`The local media storage keeps only ${MEDIA_CONTENT_TYPE} files.`);
    }

    const directory = await this.createdDirectory(location.directory);
    const temporary = join(directory, `.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, data, { flag: 'wx', flush: true });
      await rename(temporary, join(directory, location.file));
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }

  async read(key: string): Promise<StoredFile | undefined> {
    if (!isStorageKey(key)) {
      return undefined;
    }

    const location = locationOf(key);
    const directory = await this.existingDirectory(location.directory);
    if (!directory) {
      return undefined;
    }

    const path = join(directory, location.file);
    if (!(await this.isRegularFile(path))) {
      return undefined;
    }

    const handle = await openWithoutFollowing(path);
    if (!handle) {
      return undefined;
    }

    try {
      const stats = await handle.stat();
      if (!stats.isFile()) {
        await handle.close();
        return undefined;
      }

      return {
        body: handle.createReadStream(),
        contentType: MEDIA_CONTENT_TYPE,
        byteSize: stats.size,
      };
    } catch (error) {
      await handle.close();
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const location = locationOf(key);
    const directory = await this.existingDirectory(location.directory);
    if (!directory) {
      return;
    }

    const path = join(directory, location.file);
    if (await this.isRegularFile(path)) {
      await rm(path);
    }

    await removeEmptyDirectory(directory);
  }

  signedUrl(key: string, expiresAt: Date): Promise<string> {
    locationOf(key);

    return Promise.resolve(this.urls.signedUrl(key, expiresAt));
  }

  private resolvedRoot(): Promise<string> {
    this.realRoot ??= mkdir(this.root, { recursive: true })
      .then(() => realpath(this.root))
      .catch((error: unknown) => {
        this.realRoot = undefined;
        throw error;
      });

    return this.realRoot;
  }

  private async createdDirectory(name: string): Promise<string> {
    const root = await this.resolvedRoot();
    const path = join(root, name);
    await mkdir(root, { recursive: true });
    await mkdir(path).catch((error: unknown) => {
      if (!hasCode(error, ['EEXIST'])) {
        throw error;
      }
    });

    const entry = await lstatIfExists(path);
    if (!entry?.isDirectory()) {
      throw new Error(`The media directory ${name} is not a real directory.`);
    }

    return path;
  }

  private async existingDirectory(name: string): Promise<string | undefined> {
    const path = join(await this.resolvedRoot(), name);
    const entry = await lstatIfExists(path);
    if (!entry) {
      return undefined;
    }

    if (!entry.isDirectory()) {
      this.logger.warn(`Refused the media directory ${name}: it is not a real directory.`);
      return undefined;
    }

    return path;
  }

  private async isRegularFile(path: string): Promise<boolean> {
    const entry = await lstatIfExists(path);
    if (!entry) {
      return false;
    }

    if (!entry.isFile()) {
      this.logger.warn(`Refused the media file ${path}: it is not a regular file.`);
      return false;
    }

    return true;
  }
}

function locationOf(key: string): Location {
  const [directory, file] = key.split('/');
  if (!isStorageKey(key) || directory === undefined || file === undefined) {
    throw new Error('Invalid media storage key.');
  }

  return { directory, file };
}

async function lstatIfExists(path: string): Promise<Stats | undefined> {
  try {
    return await lstat(path);
  } catch (error) {
    if (hasCode(error, MISSING_CODES)) {
      return undefined;
    }

    throw error;
  }
}

async function openWithoutFollowing(path: string): Promise<FileHandle | undefined> {
  try {
    return await open(path, READ_WITHOUT_FOLLOWING);
  } catch (error) {
    if (hasCode(error, MISSING_CODES)) {
      return undefined;
    }

    throw error;
  }
}

async function removeEmptyDirectory(path: string): Promise<void> {
  try {
    await rmdir(path);
  } catch (error) {
    if (!hasCode(error, KEPT_DIRECTORY_CODES)) {
      throw error;
    }
  }
}

function hasCode(error: unknown, codes: readonly string[]): boolean {
  return error instanceof Error && 'code' in error && codes.includes(String(error.code));
}
