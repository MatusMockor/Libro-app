import type { INestApplication } from '@nestjs/common';
import type { SeederFactoryManager } from 'typeorm-extension';
import { SessionService } from '../../src/modules/auth/application/session.service.js';
import type { UserFactoryMeta } from '../../src/modules/auth/factories/user.factory.js';
import { UserEntity } from '../../src/modules/auth/persistence/user.entity.js';

export interface SignedInUser {
  readonly id: string;
  readonly email: string;
  readonly authorization: string;
  readonly refreshToken: string;
}

export type SignIn = (meta?: UserFactoryMeta) => Promise<SignedInUser>;

export function signInWith(app: INestApplication, factories: SeederFactoryManager): SignIn {
  const sessions = app.get(SessionService);

  return async (meta = {}) => {
    const { id, email } = await factories
      .get<UserEntity, UserFactoryMeta>(UserEntity)
      .setMeta(meta)
      .save();
    const { accessToken, refreshToken } = await sessions.start({ id, email });

    return {
      id,
      email,
      authorization: `Bearer ${accessToken.value}`,
      refreshToken: refreshToken.value,
    };
  };
}
