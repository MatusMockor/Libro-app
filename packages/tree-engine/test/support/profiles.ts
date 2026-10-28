import type { TreeInputV1 } from '../../src/index.ts';
import { decoration, HOUR, MINUTE, part, reading, session, sessions } from './readings.ts';

export const SEED_ONLY: TreeInputV1 = reading({
  seed: 'seed-only',
  sessions: [session(4 * MINUTE), session(30 * MINUTE, [], 0)],
});

export const STARTED: TreeInputV1 = reading({
  seed: 'started',
  sessions: [session(25 * MINUTE), session(40 * MINUTE, [part('good', 12, 18)])],
});

export const LIKED_IT: TreeInputV1 = reading({
  seed: 'liked-it',
  finished: true,
  sessions: sessions(12, 50 * MINUTE, (index) => [
    part('good', index * 20 + 1, index * 20 + 9),
    ...(index % 3 === 0 ? [part('good', index * 20 + 10, index * 20 + 40)] : []),
  ]),
});

export const SKIMMED: TreeInputV1 = reading({
  seed: 'skimmed',
  finished: true,
  sessions: [
    session(20 * MINUTE, [part('skipped', 1, 40), part('skipped', 60, 90)]),
    session(15 * MINUTE, [part('skipped', 100, 160)]),
    session(25 * MINUTE, [part('skipped', 170, 240), part('slow', 241, 250)]),
  ],
});

export const SLOW_READ: TreeInputV1 = reading({
  seed: 'slow-read',
  sessions: sessions(6, HOUR, (index) => [part('slow', index * 30 + 1, index * 30 + 25)]),
});

export const GROUP: TreeInputV1 = reading({
  seed: 'group',
  finished: true,
  sessions: sessions(5, 45 * MINUTE),
  decorations: [
    decoration('group-1', 'group_reading'),
    decoration('group-2', 'group_reading'),
    decoration('insight-1', 'insight'),
    decoration('congrats-1', 'congratulation'),
  ],
});

export const PROFILES = {
  'seed only': SEED_ONLY,
  started: STARTED,
  'liked it': LIKED_IT,
  skimmed: SKIMMED,
  'slow read': SLOW_READ,
  group: GROUP,
} as const;
