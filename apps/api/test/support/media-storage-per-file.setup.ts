import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { aroundAll } from 'vitest';

const directory = await mkdtemp(join(tmpdir(), 'libro-media-'));
process.env.MEDIA_LOCAL_ROOT = join(directory, 'media');

aroundAll(async (runSuite) => {
  await runSuite();
  await rm(directory, { recursive: true, force: true });
});
