export const DELETED_ACCOUNTS_PURGE = Symbol('DELETED_ACCOUNTS_PURGE');

export interface DeletedAccountsPurge {
  replayAll(): Promise<number>;
  forgetExpired(): Promise<number>;
}
