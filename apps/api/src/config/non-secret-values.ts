export const LOCAL_DEV_JWT_ACCESS_SECRET = 'local-dev-only-access-token-secret-change-me';
export const TEST_JWT_ACCESS_SECRET = 'test-only-access-token-secret-not-for-real-use';

export const NON_SECRET_JWT_ACCESS_SECRETS: readonly string[] = [
  LOCAL_DEV_JWT_ACCESS_SECRET,
  TEST_JWT_ACCESS_SECRET,
];
