export const PLACE_MAX_LENGTH = 100;

export function normalisePlace(place: string | null): string | null {
  const trimmed = place?.trim() ?? '';

  return trimmed === '' ? null : trimmed;
}
