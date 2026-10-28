import { z } from 'zod';
import type { AuthSession } from '../application/auth-session.js';
import { toUserResponse, userSchema } from './user.response.js';

export const authSessionSchema = z
  .object({
    user: userSchema,
    accessToken: z.string().meta({ description: 'Send as Authorization: Bearer <accessToken>' }),
    tokenType: z.literal('Bearer'),
    expiresIn: z.int().meta({ description: 'Seconds until the access token expires' }),
    refreshToken: z.string().meta({
      description: 'Single use: POST it to /v1/auth/refresh for new tokens, or to /v1/auth/logout',
    }),
    refreshTokenExpiresIn: z.int().meta({
      description: 'Seconds until the sign-in expires; refreshing never extends it',
    }),
  })
  .meta({ id: 'AuthSession' });

export type AuthSessionResponse = z.infer<typeof authSessionSchema>;

export function toAuthSessionResponse({
  user,
  accessToken,
  refreshToken,
}: AuthSession): AuthSessionResponse {
  return {
    user: toUserResponse(user),
    accessToken: accessToken.value,
    tokenType: 'Bearer',
    expiresIn: accessToken.expiresIn,
    refreshToken: refreshToken.value,
    refreshTokenExpiresIn: refreshToken.expiresIn,
  };
}
