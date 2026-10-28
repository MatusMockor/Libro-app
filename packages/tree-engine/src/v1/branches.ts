import type { CountedSession } from './counting.ts';
import { branchId } from './ids.ts';
import { MAX_BRANCHES } from './limits.ts';
import { clamp, scale } from './numbers.ts';
import { type Random, randomFor } from './random.ts';
import type { BranchV1, TrunkV1 } from './types.ts';

const ALWAYS_ON_TRUNK = 3;
const TRUNK_ATTACH_PERCENT = 55;

interface BranchDice {
  readonly parentRoll: number;
  readonly parentPick: number;
  readonly side: 1 | -1;
  readonly spread: number;
  readonly place: number;
  readonly reach: number;
}

export function growBranches(
  seed: string,
  sessions: readonly CountedSession[],
  trunk: TrunkV1,
): BranchV1[] {
  const branches: BranchV1[] = [];

  for (const session of sessions.slice(0, MAX_BRANCHES)) {
    branches.push(growBranch(seed, session, trunk, branches));
  }

  return branches;
}

function growBranch(
  seed: string,
  session: CountedSession,
  trunk: TrunkV1,
  earlier: readonly BranchV1[],
): BranchV1 {
  const dice = rollBranchDice(randomFor(seed, 'branch', String(session.index)));
  const parent = pickParent(dice, session.index, earlier);

  if (parent === undefined) {
    return trunkBranch(session, dice, trunk);
  }

  return childBranch(session, dice, parent);
}

function rollBranchDice(random: Random): BranchDice {
  return {
    parentRoll: random.int(0, 99),
    parentPick: random.nextUint32(),
    side: random.sign(),
    spread: random.int(0, 1000),
    place: random.int(0, 1000),
    reach: random.int(0, 100),
  };
}

function pickParent(
  dice: BranchDice,
  index: number,
  earlier: readonly BranchV1[],
): BranchV1 | undefined {
  if (index < ALWAYS_ON_TRUNK || dice.parentRoll < TRUNK_ATTACH_PERCENT) {
    return undefined;
  }

  const limbs = earlier.filter((branch) => branch.parentId === null);

  return limbs[dice.parentPick % limbs.length];
}

function trunkBranch(session: CountedSession, dice: BranchDice, trunk: TrunkV1): BranchV1 {
  const climb = 250 + Math.floor((650 * session.index) / (session.index + 8));
  const position = clamp(climb + scale(80, dice.place) - 40, 150, 980);
  const taper = 1000 - Math.floor((position * 55) / 100);
  const reach = 450 + Math.floor(session.vigour / 2) + dice.reach;

  return {
    id: branchId(session.index),
    parentId: null,
    position,
    angle: dice.side * (30 + scale(35, dice.spread)),
    length: Math.max(4, scale(scale(trunk.height, taper), reach)),
    thickness: Math.max(1, scale(trunk.thickness, 300 + Math.floor(session.vigour / 4))),
    bare: false,
  };
}

function childBranch(session: CountedSession, dice: BranchDice, parent: BranchV1): BranchV1 {
  const reach = 500 + Math.floor(session.vigour / 4) + dice.reach;

  return {
    id: branchId(session.index),
    parentId: parent.id,
    position: 250 + scale(600, dice.place),
    angle: dice.side * (20 + scale(30, dice.spread)),
    length: Math.max(3, scale(parent.length, reach)),
    thickness: Math.max(1, scale(parent.thickness, 650)),
    bare: false,
  };
}
