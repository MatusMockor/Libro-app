import { createHmac, timingSafeEqual } from 'node:crypto';

const EXPIRES_PATTERN = /^\d{1,12}$/;

const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export class MediaUrlSignature {
  constructor(private readonly secret: string) {}

  sign(key: string, expiresAtSeconds: number): string {
    return createHmac('sha256', this.secret)
      .update(`${key}\n${String(expiresAtSeconds)}`)
      .digest('base64url');
  }

  isValid(key: string, expires: string, signature: string, nowSeconds: number): boolean {
    if (!EXPIRES_PATTERN.test(expires) || !SIGNATURE_PATTERN.test(signature)) {
      return false;
    }

    const expected = Buffer.from(this.sign(key, Number(expires)));
    const presented = Buffer.from(signature);

    return timingSafeEqual(expected, presented) && Number(expires) > nowSeconds;
  }
}
