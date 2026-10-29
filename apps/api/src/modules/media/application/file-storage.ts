import type { Readable } from 'node:stream';

export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface StoredFile {
  readonly body: Readable;
  readonly contentType: string;
  readonly byteSize: number;
}

export interface FileStorage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  read(key: string): Promise<StoredFile | undefined>;
  delete(key: string): Promise<void>;
  signedUrl(key: string, expiresAt: Date): Promise<string>;
}
