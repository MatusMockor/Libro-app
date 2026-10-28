export interface Reading {
  readonly id: string;
  readonly workId: string;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
}
