import type { DeepReadonly } from './deep-readonly.js';

const NOT_PLAIN = 'Domain event payloads may contain only plain objects, arrays and primitives.';

interface Snapshot {
  readonly ancestors: WeakSet<object>;
  readonly copies: WeakMap<object, object>;
}

export function plainDataSnapshot<T>(value: T): DeepReadonly<T> {
  return copy(value, { ancestors: new WeakSet(), copies: new WeakMap() }) as DeepReadonly<T>;
}

function copy(value: unknown, snapshot: Snapshot): unknown {
  if (typeof value === 'function' || typeof value === 'symbol') {
    throw new TypeError(NOT_PLAIN);
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  if (snapshot.ancestors.has(value)) {
    throw new TypeError('Domain event payloads must not contain cycles.');
  }

  const existing = snapshot.copies.get(value);
  if (existing) {
    return existing;
  }

  snapshot.ancestors.add(value);
  const result = Object.freeze(copyFields(value, snapshot));
  snapshot.ancestors.delete(value);
  snapshot.copies.set(value, result);

  return result;
}

function copyFields(value: object, snapshot: Snapshot): object {
  const target = emptyCopyOf(value);

  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError('Domain event payloads must not contain symbol fields.');
  }

  for (const key of fieldNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
      throw new TypeError(
        'Domain event payloads must contain only enumerable data fields (no getters or hidden fields).',
      );
    }

    Object.defineProperty(target, key, {
      value: copy(descriptor.value, snapshot),
      enumerable: true,
    });
  }

  return target;
}

function emptyCopyOf(value: object): object {
  const prototype: unknown = Object.getPrototypeOf(value);

  if (Array.isArray(value) && prototype === Array.prototype) {
    return new Array<unknown>(value.length);
  }

  if (Array.isArray(value) || (prototype !== Object.prototype && prototype !== null)) {
    throw new TypeError(NOT_PLAIN);
  }

  return Object.create(prototype) as object;
}

function fieldNames(value: object): string[] {
  const names = Object.getOwnPropertyNames(value);

  return Array.isArray(value) ? names.filter((name) => name !== 'length') : names;
}
