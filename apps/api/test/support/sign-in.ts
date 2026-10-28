import type { INestApplication } from '@nestjs/common';
import type { SeederFactoryManager } from 'typeorm-extension';
import {
  ACCESS_TOKEN_ISSUER,
  type AccessTokenIssuer,
} from '../../src/modules/auth/application/access-token-issuer.js';
import type { UserFactoryMeta } from '../../src/modules/auth/factories/user.factory.js';
import { UserEntity } from '../../src/modules/auth/persistence/user.entity.js';

export interface SignedInUser {
  readonly id: string;
  readonly email: string;
  readonly authorization: string;
}

export type SignIn = (meta?: UserFactoryMeta) => Promise<SignedInUser>;

export function signInWith(app: INestApplication, factories: SeederFactoryManager): SignIn {
  const accessTokens = app.get<AccessTokenIssuer>(ACCESS_TOKEN_ISSUER);

  return async (meta = {}) => {
    const user = await factories.get<UserEntity, UserFactoryMeta>(UserEntity).setMeta(meta).save();
    const { value } = await accessTokens.issue(user.id);

    return { id: user.id, email: user.email, authorization: `Bearer ${value}` };
  };
}
