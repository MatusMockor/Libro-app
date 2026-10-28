import type { AuthenticatedUser } from './authenticated-user.js';

const users = new WeakMap<object, AuthenticatedUser>();

export function attachAuthenticatedUser(request: object, user: AuthenticatedUser): void {
  users.set(request, user);
}

export function authenticatedUserOf(request: object): AuthenticatedUser | undefined {
  return users.get(request);
}
