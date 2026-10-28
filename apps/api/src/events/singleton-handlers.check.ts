import { Injectable, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper.js';
import { EVENT_LISTENER_METADATA } from '@nestjs/event-emitter';

@Injectable()
export class SingletonHandlersCheck implements OnModuleInit {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
  ) {}

  onModuleInit(): void {
    const scoped = [...this.discovery.getProviders(), ...this.discovery.getControllers()]
      .filter((wrapper) => !isSingleton(wrapper) && this.hasHandlers(wrapper))
      .map((wrapper) => String(wrapper.name));

    if (scoped.length === 0) {
      return;
    }

    throw new Error(
      `Domain event handlers must live in singleton providers. Request or transient scoped: ${scoped.join(', ')}.`,
    );
  }

  private hasHandlers(wrapper: InstanceWrapper): boolean {
    const prototype: unknown = wrapper.metatype?.prototype;
    if (!isObject(prototype) || wrapper.isNotMetatype) {
      return false;
    }

    return this.scanner
      .getAllMethodNames(prototype)
      .some((name) => Reflect.hasMetadata(EVENT_LISTENER_METADATA, prototype[name] as object));
  }
}

function isSingleton(wrapper: InstanceWrapper): boolean {
  return !wrapper.isTransient && wrapper.isDependencyTreeStatic();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
