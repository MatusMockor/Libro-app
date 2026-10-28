import type { CountedSession } from './counting.ts';
import type { BranchV1 } from './types.ts';

export interface HostedSlot<Detail> {
  readonly host: BranchV1;
  readonly index: number;
  readonly detail: Detail;
}

export function hostedSlots<Detail>(
  sessions: readonly CountedSession[],
  branches: readonly BranchV1[],
  budgetPerHost: number,
  detailsOf: (session: CountedSession, room: number) => readonly Detail[],
): HostedSlot<Detail>[] {
  const slots: HostedSlot<Detail>[] = [];
  const used = new Map<string, number>();

  for (const session of sessions) {
    const host = branches[session.index % branches.length];

    if (host === undefined) {
      continue;
    }

    const taken = used.get(host.id) ?? 0;
    const room = budgetPerHost - taken;

    if (room <= 0) {
      continue;
    }

    const details = detailsOf(session, room).slice(0, room);
    details.forEach((detail, offset) => slots.push({ host, index: taken + offset, detail }));
    used.set(host.id, taken + details.length);
  }

  return slots;
}
