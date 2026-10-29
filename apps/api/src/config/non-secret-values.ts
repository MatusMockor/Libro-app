export const LOCAL_DEV_JWT_ACCESS_SECRET = 'local-dev-only-access-token-secret-change-me';
export const TEST_JWT_ACCESS_SECRET = 'test-only-access-token-secret-not-for-real-use';

export const NON_SECRET_JWT_ACCESS_SECRETS: readonly string[] = [
  LOCAL_DEV_JWT_ACCESS_SECRET,
  TEST_JWT_ACCESS_SECRET,
];

export const LOCAL_DEV_MEDIA_URL_SIGNING_SECRET =
  'local-dev-only-media-url-signing-secret-change-me';
export const TEST_MEDIA_URL_SIGNING_SECRET = 'test-only-media-url-signing-secret-not-for-real-use';

export const NON_SECRET_MEDIA_URL_SIGNING_SECRETS: readonly string[] = [
  LOCAL_DEV_MEDIA_URL_SIGNING_SECRET,
  TEST_MEDIA_URL_SIGNING_SECRET,
];
