import type { MediaUrlSignature } from './media-url-signature.js';

export const LOCAL_MEDIA_FILES_ROUTE = 'media/files';

const LOCAL_MEDIA_FILES_PATH = `/v1/${LOCAL_MEDIA_FILES_ROUTE}`;

const MILLISECONDS_PER_SECOND = 1000;

export class LocalMediaUrls {
  constructor(
    private readonly publicApiUrl: string,
    private readonly signature: MediaUrlSignature,
  ) {}

  signedUrl(key: string, expiresAt: Date): string {
    const expires = Math.floor(expiresAt.getTime() / MILLISECONDS_PER_SECOND);
    const query = new URLSearchParams({
      expires: String(expires),
      signature: this.signature.sign(key, expires),
    });
    const path = key.split('/').map(encodeURIComponent).join('/');

    return `${this.publicApiUrl}${LOCAL_MEDIA_FILES_PATH}/${path}?${query.toString()}`;
  }
}
