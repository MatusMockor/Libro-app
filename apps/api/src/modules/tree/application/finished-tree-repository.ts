export const FINISHED_TREE_REPOSITORY = Symbol('FINISHED_TREE_REPOSITORY');

export interface FinishedTrees {
  readonly userId: string;
  readonly readingIds: readonly string[];
  readonly treeEngineVersion: number;
}

export interface FinishedTreeRepository {
  record(trees: FinishedTrees): Promise<void>;
  storedVersions(userId: string, readingIds: readonly string[]): Promise<Map<string, number>>;
  deleteAllOf(userId: string): Promise<void>;
}
