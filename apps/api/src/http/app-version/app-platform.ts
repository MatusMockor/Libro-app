export const APP_PLATFORMS = ['ios', 'android'] as const;

export type AppPlatform = (typeof APP_PLATFORMS)[number];

export function parseAppPlatform(value: string): AppPlatform | undefined {
  const normalised = value.toLowerCase();

  return APP_PLATFORMS.find((platform) => platform === normalised);
}
