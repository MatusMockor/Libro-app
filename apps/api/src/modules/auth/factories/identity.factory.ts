import { setSeederFactory, type FactoryCallback } from 'typeorm-extension';
import type { IdentityProvider } from '../../identity-providers/index.js';
import { IdentityEntity } from '../persistence/identity.entity.js';

export interface IdentityFactoryMeta {
  userId?: string;
  provider?: IdentityProvider;
  subject?: string;
}

const FIRST_SERIAL = 1;

const SUBJECT_PREFIX = '1000000000000000';
const SUBJECT_SERIAL_DIGITS = 5;

export function createIdentityFactory(): FactoryCallback<IdentityEntity, IdentityFactoryMeta> {
  let serial = FIRST_SERIAL;

  return (meta) => {
    const subject = `${SUBJECT_PREFIX}${String(serial++).padStart(SUBJECT_SERIAL_DIGITS, '0')}`;

    return Object.assign(new IdentityEntity(), { provider: 'google', subject, ...meta });
  };
}

export default setSeederFactory(IdentityEntity, createIdentityFactory());
