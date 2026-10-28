import { z } from 'zod';
import type { User } from '../domain/user.js';

export const userSchema = z.object({ id: z.uuid(), email: z.email() }).meta({ id: 'User' });

export type UserResponse = z.infer<typeof userSchema>;

export function toUserResponse({ id, email }: User): UserResponse {
  return { id, email };
}
