import type { DeepReadonly } from './deep-readonly.js';

const NOT_PLAIN = 'Domain event payloads may contain only plain objects, arrays and primitives.';

interface Traversal {
  readonly ancestors: WeakSet<object>;
  readonly completed: WeakSet<object>;
  readonly visit: (node: object) => void;
}

export function assertPlainData(value: unknown): void {
  visitPlainData(
    value,
    traversal(() => undefined),
  );
}

export function deepFreeze<T>(value: T): DeepReadonly<T> {
  visitPlainData(
    value,
    traversal((node) => Object.freeze(node)),
  );

  return value as DeepReadonly<T>;
}

function traversal(visit: (node: object) => void): Traversal {
  return { ancestors: new WeakSet(), completed: new WeakSet(), visit };
}

function visitPlainData(value: unknown, state: Traversal): void {
  if (typeof value !== 'object' || value === null) {
    return;
  }

  if (state.ancestors.has(value)) {
    throw new TypeError('Domain event payloads must not contain cycles.');
  }

  if (state.completed.has(value)) {
    return;
  }

  if (!isPlainData(value)) {
    throw new TypeError(NOT_PLAIN);
  }

  if (hasHiddenFields(value)) {
    throw new TypeError('Domain event payloads must not contain non-enumerable or symbol fields.');
  }

  state.ancestors.add(value);
  Object.values(value).forEach((child) => {
    visitPlainData(child, state);
  });
  state.ancestors.delete(value);
  state.completed.add(value);
  state.visit(value);
}

function isPlainData(value: object): boolean {
  if (Array.isArray(value)) {
    return true;
  }

  const prototype: unknown = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function hasHiddenFields(value: object): boolean {
  if (Object.getOwnPropertySymbols(value).length > 0) {
    return true;
  }

  return Object.getOwnPropertyNames(value)
    .filter((key) => !(Array.isArray(value) && key === 'length'))
    .some((key) => !Object.prototype.propertyIsEnumerable.call(value, key));
}
