import { assert, describe, expect, it } from 'vitest';
import { AppVersion } from '../src/shared/app-version.js';

function version(value: string): AppVersion {
  const parsed = AppVersion.parse(value);
  assert(parsed, `expected ${value} to parse`);

  return parsed;
}

describe('AppVersion', () => {
  it.for(['0.0.0', '1.4.0', '10.20.30', '01.2.3'])('parses %s', (value) => {
    expect(AppVersion.parse(value)).toBeInstanceOf(AppVersion);
  });

  it.for([
    '',
    '1',
    '1.4',
    '1.4.0.1',
    'v1.4.0',
    '1.4.0-beta.1',
    '1.4.0+build',
    ' 1.4.0',
    '1.-4.0',
    '99999999999999999999.0.0',
  ])('refuses %j', (value) => {
    expect(AppVersion.parse(value)).toBeUndefined();
  });

  it('prints the normalised version', () => {
    expect(version('01.4.0').toString()).toBe('1.4.0');
  });

  it.for([
    { older: '1.9.0', newer: '1.10.0' },
    { older: '1.4.0', newer: '2.0.0' },
    { older: '2.3.4', newer: '2.4.0' },
    { older: '2.3.4', newer: '2.3.5' },
    { older: '0.0.0', newer: '0.0.1' },
  ])('knows $older is older than $newer', ({ older, newer }) => {
    expect(version(older).isOlderThan(version(newer))).toBe(true);
    expect(version(newer).isOlderThan(version(older))).toBe(false);
  });

  it('does not treat an equal version as older', () => {
    expect(version('1.4.0').isOlderThan(version('1.4.0'))).toBe(false);
  });
});
