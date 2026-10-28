import { hashSync } from '@node-rs/argon2';
import { setSeederFactory, type FactoryCallback } from 'typeorm-extension';
import { normaliseEmail } from '../domain/email.js';
import { UserEntity } from '../persistence/user.entity.js';
import { toUserEntity } from '../persistence/user.mapper.js';
import { ARGON2_OPTIONS } from '../security/argon2-password.hasher.js';

export interface UserFactoryMeta {
  email?: string;
}

export const FACTORY_USER_PASSWORD = 'correct horse battery staple';

const FIRST_SERIAL = 1;

let factoryPasswordHash: string | undefined;

function passwordHash(): string {
  factoryPasswordHash ??= hashSync(FACTORY_USER_PASSWORD, ARGON2_OPTIONS);

  return factoryPasswordHash;
}

export function createUserFactory(): FactoryCallback<UserEntity, UserFactoryMeta> {
  let serial = FIRST_SERIAL;

  return (meta) =>
    toUserEntity({
      email: normaliseEmail(meta?.email ?? `reader-${String(serial++)}@example.test`),
      passwordHash: passwordHash(),
    });
}

export default setSeederFactory(UserEntity, createUserFactory());
