import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../events/event-bus.js';
import { UserRegistered } from '../events/user-registered.event.js';
import type { AuthSession } from './auth-session.js';
import type { Credentials } from './credentials.js';
import { PASSWORD_HASHER, type PasswordHasher } from './password-hasher.js';
import { SessionService } from './session.service.js';
import { USER_REPOSITORY, type UserRepository } from './user-repository.js';

@Injectable()
export class RegisterService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly sessions: SessionService,
  ) {}

  async register({ email, password }: Credentials): Promise<AuthSession> {
    const user = await this.users.add({ email, passwordHash: await this.passwords.hash(password) });

    await this.events.publish(UserRegistered.create({ userId: user.id }));

    return this.sessions.start(user);
  }
}
