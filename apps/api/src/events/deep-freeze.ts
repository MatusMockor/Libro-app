import type { DeepReadonly } from './deep-readonly.js';

export function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (typeof value !== 'object' || value === null) {
    return value as DeepReadonly<T>;
  }

  Object.values(value).forEach(deepFreeze);

  return Object.freeze(value) as DeepReadonly<T>;
}
