import {
  isTreeEngineVersion,
  LATEST_TREE_ENGINE_VERSION,
  type TreeEngineVersion,
} from '@libro/tree-engine';
import type { ReadingWithSessions } from '../../reading-sessions/index.js';
import { TreeEngineVersionUnavailableException } from './tree-engine-version-unavailable.exception.js';

export class TreeEngineVersions {
  constructor(private readonly stored: ReadonlyMap<string, number>) {}

  of({ id, finishedAt }: Pick<ReadingWithSessions, 'id' | 'finishedAt'>): TreeEngineVersion {
    if (finishedAt === null) {
      return LATEST_TREE_ENGINE_VERSION;
    }

    const version = this.stored.get(id);
    if (!isTreeEngineVersion(version)) {
      throw new TreeEngineVersionUnavailableException(id, version);
    }

    return version;
  }
}
