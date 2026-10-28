export const REFRESH_TOKEN_GENERATOR = Symbol('REFRESH_TOKEN_GENERATOR');

export interface RefreshTokenSecret {
  readonly value: string;
  readonly hash: string;
}

export interface RefreshTokenGenerator {
  generate(): RefreshTokenSecret;
  hashOf(value: string): string;
}
