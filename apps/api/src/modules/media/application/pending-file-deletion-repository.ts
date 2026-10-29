export const PENDING_FILE_DELETION_REPOSITORY = Symbol('PENDING_FILE_DELETION_REPOSITORY');

export interface FailedFileDeletion {
  readonly storageKey: string;
  readonly error: string;
}

export interface PendingFileDeletionPage {
  readonly afterKey: string | undefined;
  readonly limit: number;
}

export interface PendingFileDeletionRepository {
  page(page: PendingFileDeletionPage): Promise<string[]>;
  due(limit: number, excluding: readonly string[]): Promise<string[]>;
  complete(storageKeys: readonly string[]): Promise<void>;
  fail(failures: readonly FailedFileDeletion[]): Promise<void>;
}
