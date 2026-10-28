import { Logger } from '@nestjs/common';
import { OnEvent, type OnEventOptions } from '@nestjs/event-emitter';
import { domainEventKey, type DomainEvent, type DomainEventType } from './domain-event.js';

type DomainEventHandler<TPayload extends object> = (
  event: DomainEvent<TPayload>,
) => void | Promise<void>;

const LISTENER_OPTIONS: OnEventOptions = {
  async: false,
  promisify: false,
  nextTick: false,
  suppressErrors: false,
};

const logger = new Logger('DomainEvents');

export function OnDomainEvent<TPayload extends object>(type: DomainEventType<TPayload>) {
  return <THandler extends DomainEventHandler<TPayload>>(
    target: object,
    key: string | symbol,
    descriptor: TypedPropertyDescriptor<THandler>,
  ): TypedPropertyDescriptor<THandler> => {
    const handle = descriptor.value;
    if (!handle) {
      return descriptor;
    }

    const handler = `${target.constructor.name}.${String(key)}`;
    descriptor.value = isolated(handle, handler) as THandler;

    OnEvent(domainEventKey(type), LISTENER_OPTIONS)(target, key, descriptor);

    return descriptor;
  };
}

function isolated<TPayload extends object>(
  handle: DomainEventHandler<TPayload>,
  handler: string,
): DomainEventHandler<TPayload> {
  return async function (this: unknown, event: DomainEvent<TPayload>): Promise<void> {
    try {
      await handle.call(this, event);
    } catch (error) {
      logger.error(
        `Handler ${handler} failed for ${event.name} v${String(event.version)}: ${String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  };
}
