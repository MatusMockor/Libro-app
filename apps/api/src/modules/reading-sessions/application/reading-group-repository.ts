import type { SessionViewer } from '../domain/reading-group.js';
import type { SessionOwner } from './reading-session-repository.js';

export const READING_GROUP_REPOSITORY = Symbol('READING_GROUP_REPOSITORY');

export interface JoinRequest {
  readonly viewer: SessionViewer;
  readonly targetSessionId: string;
  readonly place: string | null;
}

export type JoinOutcome =
  | { readonly kind: 'joined'; readonly sessionId: string }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'own_session' }
  | { readonly kind: 'already_open' }
  | { readonly kind: 'ended' }
  | { readonly kind: 'removed' }
  | { readonly kind: 'full' };

export type LeaveOutcome =
  { readonly kind: 'left' } | { readonly kind: 'not_found' } | { readonly kind: 'not_in_group' };

export interface ParticipantRemoval {
  readonly host: SessionOwner;
  readonly participantSessionId: string;
}

export type RemovalOutcome =
  | { readonly kind: 'removed' }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'ended' }
  | { readonly kind: 'participant_not_found' };

export interface ReadingGroupRepository {
  join(request: JoinRequest): Promise<JoinOutcome>;
  leave(participant: SessionOwner): Promise<LeaveOutcome>;
  removeParticipant(removal: ParticipantRemoval): Promise<RemovalOutcome>;
}
