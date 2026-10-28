export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

export interface NewSession {
  readonly userId: string;
  readonly expiresAt: Date;
  readonly refreshTokenHash: string;
}

export interface TokenRotation {
  readonly presentedHash: string;
  readonly replacementHash: string;
}

export type RotationResult =
  | { readonly kind: 'rotated'; readonly userId: string; readonly expiresAt: Date }
  | { readonly kind: 'reused'; readonly sessionId: string }
  | { readonly kind: 'rejected' };

export interface SessionRepository {
  start(session: NewSession): Promise<void>;
  rotate(rotation: TokenRotation): Promise<RotationResult>;
  revokeByToken(tokenHash: string): Promise<void>;
}
