import type { TreeV1 } from '../../src/index.ts';

export function shapeOf(tree: TreeV1): TreeV1 {
  return { ...tree, decorations: [] };
}

export function numbersIn(value: unknown): number[] {
  if (typeof value === 'number') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(numbersIn);
  }

  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap(numbersIn);
  }

  return [];
}

export function leafTypesIn(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(leafTypesIn);
  }

  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap(leafTypesIn);
  }

  return [value === null ? 'null' : typeof value];
}
