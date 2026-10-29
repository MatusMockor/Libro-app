export const DELETED_ACCOUNT_REPOSITORY = Symbol('DELETED_ACCOUNT_REPOSITORY');

export interface DeletedAccountPage {
  readonly afterUserId: string | undefined;
  readonly limit: number;
}

export interface DeletedAccountRepository {
  forgetDeletedBefore(retentionDays: number): Promise<number>;
  userIds(page: DeletedAccountPage): Promise<string[]>;
}
