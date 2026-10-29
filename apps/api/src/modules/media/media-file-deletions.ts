export const MEDIA_FILE_DELETIONS = Symbol('MEDIA_FILE_DELETIONS');

export interface MediaFileDeletionReport {
  readonly deleted: number;
  readonly failed: number;
}

export interface MediaFileDeletions {
  retryPending(): Promise<MediaFileDeletionReport>;
}
