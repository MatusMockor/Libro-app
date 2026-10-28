import { deepFreeze } from './deep-freeze.js';
import type { DeepReadonly } from './deep-readonly.js';

const EVENT_NAME = /^[A-Z][A-Za-z0-9]*$/;

export interface DomainEvent<TPayload extends object = object> {
  readonly name: string;
  readonly version: number;
  readonly occurredAt: Date;
  readonly payload: DeepReadonly<TPayload>;
}

export interface DomainEventType<TPayload extends object> {
  readonly name: string;
  readonly version: number;
  create(payload: TPayload, occurredAt?: Date): DomainEvent<TPayload>;
}

export type DomainEventOf<TType> =
  TType extends DomainEventType<infer TPayload> ? DomainEvent<TPayload> : never;

export function defineDomainEvent<TPayload extends object>(
  name: string,
  version: number,
): DomainEventType<TPayload> {
  if (!EVENT_NAME.test(name)) {
    throw new Error(`Domain event name "${name}" must be PascalCase, e.g. BookFinished.`);
  }

  if (!Number.isInteger(version) || version < 1) {
    throw new Error(
      `Domain event ${name} version must be a positive integer, got ${String(version)}.`,
    );
  }

  return Object.freeze({
    name,
    version,
    create: (payload: TPayload, occurredAt = new Date()): DomainEvent<TPayload> =>
      Object.freeze({
        name,
        version,
        occurredAt: new Date(occurredAt.getTime()),
        payload: deepFreeze(structuredClone(payload)),
      }),
  });
}

export function domainEventKey({ name, version }: Pick<DomainEvent, 'name' | 'version'>): string {
  return `${name}.v${String(version)}`;
}
