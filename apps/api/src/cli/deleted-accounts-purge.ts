import type { DeletedAccountsPurge } from '../modules/auth/index.js';
import type { MediaFileDeletions } from '../modules/media/index.js';

export interface DeletedAccountsPurgeSteps {
  readonly accounts: DeletedAccountsPurge;
  readonly mediaFiles: MediaFileDeletions;
}

export interface DeletedAccountsPurgeReport {
  readonly replayed: number;
  readonly mediaFilesDeleted: number;
  readonly mediaFilesFailed: number;
  readonly forgotten: number;
}

export async function purgeDeletedAccounts({
  accounts,
  mediaFiles,
}: DeletedAccountsPurgeSteps): Promise<DeletedAccountsPurgeReport> {
  const replayed = await accounts.replayAll();
  const files = await mediaFiles.retryPending();
  const forgotten = await accounts.forgetExpired();

  return {
    replayed,
    mediaFilesDeleted: files.deleted,
    mediaFilesFailed: files.failed,
    forgotten,
  };
}
