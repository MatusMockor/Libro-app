import type { DataSource } from 'typeorm';
import { SeederFactoryManager } from 'typeorm-extension';
import { createUserFactory } from '../../src/modules/auth/factories/user.factory.js';
import { UserEntity } from '../../src/modules/auth/persistence/user.entity.js';
import { createWorkFactory } from '../../src/modules/books/factories/work.factory.js';
import { WorkEntity } from '../../src/modules/books/persistence/work.entity.js';

export function seederFactories(dataSource: DataSource): SeederFactoryManager {
  const factories = new SeederFactoryManager({ dataSource });
  factories.set(WorkEntity, createWorkFactory());
  factories.set(UserEntity, createUserFactory());

  return factories;
}
