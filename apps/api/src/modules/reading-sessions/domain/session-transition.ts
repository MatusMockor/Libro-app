import type { SessionStatus } from './reading-session.js';

export type SessionTransition = 'pause' | 'resume' | 'end';

export interface TransitionRule {
  readonly from: readonly SessionStatus[];
  readonly to: SessionStatus;
}

export const TRANSITION_RULES: Readonly<Record<SessionTransition, TransitionRule>> = {
  pause: { from: ['active'], to: 'paused' },
  resume: { from: ['paused'], to: 'active' },
  end: { from: ['active', 'paused'], to: 'ended' },
};
