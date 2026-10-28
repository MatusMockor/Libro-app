export const SESSION_STATUSES = ['active', 'paused', 'ended'] as const;

export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const CHECKPOINT_STATUSES: readonly SessionStatus[] = ['active'];

export const MARKING_STATUSES: readonly SessionStatus[] = ['active', 'paused'];

export const MARKED_PART_KINDS = ['good', 'slow', 'skipped'] as const;

export type MarkedPartKind = (typeof MARKED_PART_KINDS)[number];

export interface Checkpoint {
  readonly id: string;
  readonly page: number;
  readonly recordedAt: Date;
}

export interface NewMarkedPart {
  readonly kind: MarkedPartKind;
  readonly fromPage: number;
  readonly toPage: number;
}

export interface MarkedPart extends NewMarkedPart {
  readonly id: string;
  readonly createdAt: Date;
}

export interface ReadingSession {
  readonly id: string;
  readonly readingId: string;
  readonly workId: string;
  readonly place: string | null;
  readonly status: SessionStatus;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly activeSeconds: number;
  readonly checkpoints: readonly Checkpoint[];
  readonly markedParts: readonly MarkedPart[];
}
