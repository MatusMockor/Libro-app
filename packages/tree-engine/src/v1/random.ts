const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const MULBERRY_INCREMENT = 0x6d2b79f5;

export interface Random {
  nextUint32(): number;
  int(min: number, max: number): number;
  sign(): 1 | -1;
}

export function fnv1a32(value: string): number {
  let hash = FNV_OFFSET_BASIS;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }

  return hash >>> 0;
}

export function fmix32(value: number): number {
  let hash = value;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;

  return hash >>> 0;
}

export function hashKey(...parts: readonly string[]): number {
  return fmix32(fnv1a32(parts.join('/')));
}

export function mulberry32(seed: number): Random {
  let state = seed >>> 0;

  const nextUint32 = (): number => {
    state = (state + MULBERRY_INCREMENT) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

    return (mixed ^ (mixed >>> 14)) >>> 0;
  };

  return {
    nextUint32,
    int: (min, max) => min + (nextUint32() % (max - min + 1)),
    sign: () => ((nextUint32() & 1) === 0 ? -1 : 1),
  };
}

export function randomFor(...parts: readonly string[]): Random {
  return mulberry32(hashKey(...parts));
}
