import type { DeepReadonly } from './deep-readonly.js';

export function deepFreeze<T>(value: T): DeepReadonly<T> {
  freezePlainData(value, new WeakSet());

  return value as DeepReadonly<T>;
}

function freezePlainData(value: unknown, ancestors: WeakSet<object>): void {
  if (typeof value !== 'object' || value === null) {
    return;
  }

  if (!isPlainData(value)) {
    throw new TypeError(
      'Domain event payloads may contain only plain objects, arrays and primitives.',
    );
  }

  if (ancestors.has(value)) {
    throw new TypeError('Domain event payloads must not contain cycles.');
  }

  ancestors.add(value);
  Object.values(value).forEach((child) => {
    freezePlainData(child, ancestors);
  });
  ancestors.delete(value);
  Object.freeze(value);
}

function isPlainData(value: object): boolean {
  if (Array.isArray(value)) {
    return true;
  }

  const prototype: unknown = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}
