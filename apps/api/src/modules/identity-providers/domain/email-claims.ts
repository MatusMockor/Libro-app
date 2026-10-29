export interface EmailClaims {
  readonly email: string | undefined;
  readonly emailVerified: boolean;
  readonly hostedDomain: string | undefined;
}

export type EmailAuthority = (claims: EmailClaims) => boolean;
