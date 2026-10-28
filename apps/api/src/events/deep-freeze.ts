import type { DeepReadonly } from './deep-readonly.js';

export function assertPlainData(value: unknown): void {
  visitPlainData(value, new WeakSet(), () => undefined);
}

export function deepFreeze<T>(value: T): DeepReadonly<T> {
  visitPlainData(value, new WeakSet(), (node) => Object.freeze(node));

  return value as DeepReadonly<T>;
}

function visitPlainData(
  value: unknown,
  ancestors: WeakSet<object>,
  visit: (node: object) => void,
): void {
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
    visitPlainData(child, ancestors, visit);
  });
  ancestors.delete(value);
  visit(value);
}

function isPlainData(value: object): boolean {
  if (Array.isArray(value)) {
    return true;
  }

  const prototype: unknown = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}
