import { describe, expect } from 'vitest';
import {
  HANDLE_SUFFIX_SOURCE,
  type HandleSuffixSource,
} from '../../../src/modules/profiles/application/handle-suffix-source.js';
import type { ProfileFactoryMeta } from '../../../src/modules/profiles/factories/profile.factory.js';
import { ProfileEntity } from '../../../src/modules/profiles/persistence/profile.entity.js';
import { CapturingLogger } from '../../support/capturing-logger.js';
import { integrationTest } from '../../support/integration-test.js';
import { ME_PROFILE_ROUTE, memberOf, storedProfiles } from './profiles.fixture.js';

class ScriptedHandleSuffixes implements HandleSuffixSource {
  private script: number[] = [];

  next(...values: readonly number[]): void {
    this.script = [...values];
  }

  digits(length: number): string {
    return String(this.script.shift() ?? 0).padStart(length, '0');
  }
}

const suffixes = new ScriptedHandleSuffixes();

const test = integrationTest({
  configure: (builder) => builder.overrideProvider(HANDLE_SUFFIX_SOURCE).useValue(suffixes),
})
  .extend('suffixes', () => {
    suffixes.next();

    return suffixes;
  })
  .extend('takeHandles', ({ factories }) => async (...handles: readonly string[]) => {
    for (const handle of handles) {
      await factories
        .get<ProfileEntity, ProfileFactoryMeta>(ProfileEntity)
        .setMeta({ handle })
        .save();
    }
  })
  .extend('newcomer', async ({ http, signIn }) => memberOf(http, await signIn()));

describe('the generated default handle', () => {
  test('is citatel with six digits', async ({ suffixes, newcomer }) => {
    suffixes.next(4711);

    expect((await newcomer.profile()).handle).toBe('citatel004711');
  });

  test('tries other digits while the handle is taken', async ({
    suffixes,
    takeHandles,
    newcomer,
  }) => {
    await takeHandles('citatel000001', 'citatel000002');
    suffixes.next(1, 2, 3);

    expect((await newcomer.profile()).handle).toBe('citatel000003');
  });

  test('switches to twelve digits after three taken handles', async ({
    suffixes,
    takeHandles,
    newcomer,
  }) => {
    await takeHandles('citatel000001');
    suffixes.next(1, 1, 1, 42);

    expect((await newcomer.profile()).handle).toBe('citatel000000000042');
  });

  test('answers 503 profile_provisioning_unavailable and creates no profile when every attempt is taken', async ({
    app,
    suffixes,
    takeHandles,
    newcomer,
    dataSource,
  }) => {
    const logger = new CapturingLogger();
    app.useLogger(logger);
    await takeHandles('citatel000001', 'citatel000000000001');
    suffixes.next(1, 1, 1, 1, 1, 1);

    const response = await newcomer.get(ME_PROFILE_ROUTE);

    expect(response.status).toBe(503);
    expect(response.headers['retry-after']).toBe('1');
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 503,
      detail: 'Service Unavailable',
      instance: ME_PROFILE_ROUTE,
      code: 'profile_provisioning_unavailable',
    });
    expect(logger.warnings).toContain(
      `No free default handle after 6 attempts for user ${newcomer.id}`,
    );
    expect((await storedProfiles(dataSource)).map(({ userId }) => userId)).not.toContain(
      newcomer.id,
    );
  });
});
