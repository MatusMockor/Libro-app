export function distinctIdBatch(ids: readonly string[], max: number): string[] {
  const distinct = [...new Set(ids)];
  if (distinct.length > max) {
    throw new RangeError(
      `At most ${String(max)} distinct ids per call are allowed, got ${String(distinct.length)}.`,
    );
  }

  return distinct;
}
