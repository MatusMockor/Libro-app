import { computeTreeV1 } from './v1/index.ts';

export const TREE_ENGINE_VERSIONS = {
  1: computeTreeV1,
} as const;

export type TreeEngineVersion = keyof typeof TREE_ENGINE_VERSIONS;

export const LATEST_TREE_ENGINE_VERSION = 1 satisfies TreeEngineVersion;

export type LatestTreeEngineVersion = typeof LATEST_TREE_ENGINE_VERSION;

export type TreeInput<Version extends TreeEngineVersion = LatestTreeEngineVersion> = Parameters<
  (typeof TREE_ENGINE_VERSIONS)[Version]
>[0];

export type Tree<Version extends TreeEngineVersion = LatestTreeEngineVersion> = ReturnType<
  (typeof TREE_ENGINE_VERSIONS)[Version]
>;

export class UnknownTreeEngineVersionError extends Error {
  readonly version: unknown;

  constructor(version: unknown) {
    super(`Unknown tree engine version: ${String(version)}`);
    this.name = 'UnknownTreeEngineVersionError';
    this.version = version;
  }
}

export function isTreeEngineVersion(value: unknown): value is TreeEngineVersion {
  return typeof value === 'number' && Object.hasOwn(TREE_ENGINE_VERSIONS, value);
}

export function computeTree<Version extends TreeEngineVersion = LatestTreeEngineVersion>(
  input: TreeInput<Version>,
  version?: Version,
): Tree<Version> {
  const requested: unknown = version ?? LATEST_TREE_ENGINE_VERSION;

  if (!isTreeEngineVersion(requested)) {
    throw new UnknownTreeEngineVersionError(requested);
  }

  return TREE_ENGINE_VERSIONS[requested](input) as Tree<Version>;
}
