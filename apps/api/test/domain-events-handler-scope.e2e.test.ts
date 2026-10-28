import type { Provider } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, onTestFinished, test } from 'vitest';
import { EventsModule } from '../src/events/events.module.js';
import {
  ProbeInheritedScopeHandler,
  ProbeRequestContext,
  ProbeRequestScopedHandler,
  ProbeTransientHandler,
} from './support/probe-events/scoped/probe-scoped.handlers.js';
import { ProbeEventRecorder } from './support/probe-events/subscriber/probe-event-recorder.js';
import { ProbeStatsHandler } from './support/probe-events/subscriber/probe-stats.handler.js';

async function initWith(providers: Provider[]): Promise<void> {
  const moduleRef = await Test.createTestingModule({
    imports: [EventsModule],
    providers,
  }).compile();
  onTestFinished(() => moduleRef.close());

  await moduleRef.init();
}

describe('domain event handler scope', () => {
  test.for([
    {
      scope: 'request scoped',
      handler: ProbeRequestScopedHandler,
      providers: [ProbeRequestScopedHandler],
    },
    {
      scope: 'transient scoped',
      handler: ProbeTransientHandler,
      providers: [ProbeTransientHandler],
    },
    {
      scope: 'request scoped through a dependency',
      handler: ProbeInheritedScopeHandler,
      providers: [ProbeRequestContext, ProbeInheritedScopeHandler],
    },
  ])('refuses to start when a handler is $scope', async ({ handler, providers }) => {
    await expect(initWith(providers)).rejects.toThrow(
      `Domain event handlers must live in singleton providers. Request or transient scoped: ${handler.name}.`,
    );
  });

  test('starts with a singleton handler', async () => {
    await expect(initWith([ProbeEventRecorder, ProbeStatsHandler])).resolves.toBeUndefined();
  });
});
