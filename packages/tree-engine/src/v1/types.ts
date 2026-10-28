export type MarkedPartKind = 'good' | 'slow' | 'skipped';

export type DecorationKind = 'insight' | 'congratulation' | 'group_reading';

export interface CheckpointInputV1 {
  readonly page: number;
}

export interface MarkedPartInputV1 {
  readonly kind: MarkedPartKind;
  readonly fromPage: number;
  readonly toPage: number;
}

export interface SessionInputV1 {
  readonly activeSeconds: number;
  readonly checkpoints: readonly CheckpointInputV1[];
  readonly markedParts: readonly MarkedPartInputV1[];
}

export interface DecorationInputV1 {
  readonly id: string;
  readonly kind: DecorationKind;
}

export interface TreeInputV1 {
  readonly seed: string;
  readonly finished: boolean;
  readonly sessions: readonly SessionInputV1[];
  readonly decorations: readonly DecorationInputV1[];
}

export type TreeStageV1 = 'seed' | 'sapling' | 'young' | 'mature';

export interface TrunkV1 {
  readonly height: number;
  readonly thickness: number;
}

export interface BranchV1 {
  readonly id: string;
  readonly parentId: string | null;
  readonly position: number;
  readonly angle: number;
  readonly length: number;
  readonly thickness: number;
  readonly bare: boolean;
}

export interface LeafV1 {
  readonly id: string;
  readonly branchId: string;
  readonly position: number;
  readonly size: number;
}

export interface FlowerV1 {
  readonly id: string;
  readonly branchId: string;
  readonly position: number;
  readonly size: number;
}

export interface FruitV1 {
  readonly id: string;
  readonly branchId: string | null;
  readonly position: number;
  readonly size: number;
}

export interface DecorationV1 {
  readonly id: string;
  readonly kind: DecorationKind;
  readonly branchId: string | null;
  readonly position: number;
}

export interface TreeStatsV1 {
  readonly countedSessions: number;
  readonly ignoredSessions: number;
  readonly countedSeconds: number;
}

export interface TreeV1 {
  readonly treeEngineVersion: 1;
  readonly stage: TreeStageV1;
  readonly growth: number;
  readonly trunk: TrunkV1;
  readonly branches: readonly BranchV1[];
  readonly leaves: readonly LeafV1[];
  readonly flowers: readonly FlowerV1[];
  readonly fruits: readonly FruitV1[];
  readonly decorations: readonly DecorationV1[];
  readonly stats: TreeStatsV1;
}
