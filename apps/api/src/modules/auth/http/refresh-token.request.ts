import { z } from 'zod';
import { REFRESH_TOKEN_PATTERN } from '../domain/refresh-token.js';

export const refreshTokenRequestSchema = z
  .object({
    refreshToken: z
      .string()
      .regex(REFRESH_TOKEN_PATTERN, { error: 'Must be a refresh token issued by this api' })
      .meta({ description: 'The refreshToken of the latest session response' }),
  })
  .meta({ id: 'RefreshTokenRequest' });

export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;
