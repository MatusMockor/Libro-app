export const SIGN_IN_NONCE_GENERATOR = Symbol('SIGN_IN_NONCE_GENERATOR');

export interface SignInNonceSecret {
  readonly value: string;
  readonly hash: string;
}

export interface SignInNonceGenerator {
  generate(): SignInNonceSecret;
  hashOf(value: string): string;
}
