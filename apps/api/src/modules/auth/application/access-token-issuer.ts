export const ACCESS_TOKEN_ISSUER = Symbol('ACCESS_TOKEN_ISSUER');

export interface AccessToken {
  readonly value: string;
  readonly expiresIn: number;
}

export interface AccessTokenIssuer {
  issue(userId: string): Promise<AccessToken>;
}
