import { describe, expect, test } from 'vitest';
import { violations } from './lint-source.js';

const RULES = ['no-restricted-imports', 'no-restricted-syntax'];

const SERVICE = 'apps/api/src/modules/books/application/shelf.service.ts';
const CONTROLLER = 'apps/api/src/modules/books/http/books.controller.ts';
const REPOSITORY = 'apps/api/src/modules/books/persistence/typeorm-work.repository.ts';
const SEEDER = 'apps/api/src/modules/books/seeds/books.seeder.ts';
const ENTITY = 'apps/api/src/modules/books/persistence/work.entity.ts';

const DATABASE_ACCESS = 'Database access belongs in a repository class (*.repository.ts)';

const DATA_ACCESS_CODE = [
  "import { DataSource, Repository } from 'typeorm';",
  "import { InjectRepository } from '@nestjs/typeorm';",
  'export const decorators = [InjectRepository];',
  'export async function load(dataSource: DataSource, works: Repository<object>): Promise<unknown> {',
  "  await dataSource.transaction(async (manager) => manager.query('SELECT 1'));",
  "  return [works.createQueryBuilder('work'), works.manager];",
  '}',
  '',
].join('\n');

function databaseAccess(rule: string) {
  return { rule, message: expect.stringContaining(DATABASE_ACCESS) as string };
}

describe('database access lint rule', () => {
  test.for([
    {
      case: 'a DataSource import in a service',
      path: SERVICE,
      code: "import { DataSource } from 'typeorm';\nexport type Database = DataSource;\n",
      rule: 'no-restricted-imports',
    },
    {
      case: 'a type-only Repository import in a service',
      path: SERVICE,
      code: "import type { Repository } from 'typeorm';\nexport type Works = Repository<object>;\n",
      rule: 'no-restricted-imports',
    },
    {
      case: 'an InjectRepository import in a service',
      path: SERVICE,
      code: "import { InjectRepository } from '@nestjs/typeorm';\nexport const inject = InjectRepository;\n",
      rule: 'no-restricted-imports',
    },
    {
      case: 'createQueryBuilder in a service',
      path: SERVICE,
      code: "export function load(works: { createQueryBuilder(alias: string): unknown }): unknown {\n  return works.createQueryBuilder('work');\n}\n",
      rule: 'no-restricted-syntax',
    },
    {
      case: 'raw SQL through query in a controller',
      path: CONTROLLER,
      code: "export function load(db: { query(sql: string): unknown }): unknown {\n  return db.query('SELECT 1');\n}\n",
      rule: 'no-restricted-syntax',
    },
    {
      case: 'a transaction in a service',
      path: SERVICE,
      code: 'export function save(db: { transaction(work: () => void): unknown }): unknown {\n  return db.transaction(() => undefined);\n}\n',
      rule: 'no-restricted-syntax',
    },
    {
      case: 'a DataSource import from a typeorm subpath',
      path: SERVICE,
      code: "import { DataSource } from 'typeorm/data-source/DataSource.js';\nexport type Database = DataSource;\n",
      rule: 'no-restricted-imports',
    },
    {
      case: 'an InjectRepository import from a @nestjs/typeorm subpath',
      path: SERVICE,
      code: "import { InjectRepository } from '@nestjs/typeorm/dist/common/typeorm.decorators.js';\nexport const inject = InjectRepository;\n",
      rule: 'no-restricted-imports',
    },
    {
      case: 'a query builder import in a service',
      path: SERVICE,
      code: "import type { UpdateQueryBuilder } from 'typeorm';\nexport type Update = UpdateQueryBuilder<object>;\n",
      rule: 'no-restricted-imports',
    },
    {
      case: 'a dynamic import of typeorm',
      path: SERVICE,
      code: "export function load(): Promise<unknown> {\n  return import('typeorm');\n}\n",
      rule: 'no-restricted-syntax',
    },
    {
      case: 'a dynamic import of a @nestjs/typeorm subpath',
      path: SERVICE,
      code: "export function load(): Promise<unknown> {\n  return import('@nestjs/typeorm/dist/index.js');\n}\n",
      rule: 'no-restricted-syntax',
    },
    {
      case: 'raw SQL through a computed query call',
      path: SERVICE,
      code: "export function load(db: { query(sql: string): unknown }): unknown {\n  return db['query']('SELECT 1');\n}\n",
      rule: 'no-restricted-syntax',
    },
    {
      case: 'a computed createQueryBuilder call',
      path: SERVICE,
      code: "export function load(works: { createQueryBuilder(alias: string): unknown }): unknown {\n  return works['createQueryBuilder']('work');\n}\n",
      rule: 'no-restricted-syntax',
    },
    {
      case: 'a computed transaction call',
      path: SERVICE,
      code: "export function save(db: { transaction(work: () => void): unknown }): unknown {\n  return db['transaction'](() => undefined);\n}\n",
      rule: 'no-restricted-syntax',
    },
    {
      case: 'computed access to an entity manager',
      path: SERVICE,
      code: "export function managerOf(works: { manager: unknown }): unknown {\n  return works['manager'];\n}\n",
      rule: 'no-restricted-syntax',
    },
    {
      case: 'destructuring an entity manager',
      path: SERVICE,
      code: 'export function managerOf({ manager }: { manager: unknown }): unknown {\n  return manager;\n}\n',
      rule: 'no-restricted-syntax',
    },
    {
      case: 'access to an entity manager in a service',
      path: SERVICE,
      code: 'export function managerOf(works: { manager: unknown }): unknown {\n  return works.manager;\n}\n',
      rule: 'no-restricted-syntax',
    },
  ])('rejects $case', async ({ path, code, rule }) => {
    expect(await violations(path, code, RULES)).toEqual([databaseAccess(rule)]);
  });

  test('rejects require in a module', async () => {
    const code = "export const orm: unknown = require('typeorm');\n";

    expect(await violations(SERVICE, code, RULES)).toEqual([
      { rule: 'no-restricted-syntax', message: 'Use an ES module import instead of require().' },
    ]);
  });

  test('allows a query parameter that is not a call', async () => {
    const code = [
      'export function search(params: { query: string }): string[] {',
      '  const { query } = params;',
      '  return [query, params.query];',
      '}',
      '',
    ].join('\n');

    expect(await violations(SERVICE, code, RULES)).toEqual([]);
  });

  test.for([
    { case: 'a repository class', path: REPOSITORY },
    { case: 'a seeder', path: SEEDER },
  ])('allows every data access API in $case', async ({ path }) => {
    expect(await violations(path, DATA_ACCESS_CODE, RULES)).toEqual([]);
  });

  test('allows entity decorators in an entity', async () => {
    const code = [
      "import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';",
      '',
      "@Entity({ schema: 'books', name: 'shelves' })",
      'export class ShelfEntity {',
      "  @PrimaryGeneratedColumn('uuid')",
      '  id!: string;',
      '',
      "  @Column({ type: 'text' })",
      '  name!: string;',
      '}',
      '',
    ].join('\n');

    expect(await violations(ENTITY, code, RULES)).toEqual([]);
  });

  test('keeps the event transport and else rules inside modules', async () => {
    const code = [
      "import { EventEmitter2 } from '@nestjs/event-emitter';",
      'export function pick(emitter: EventEmitter2 | undefined): unknown {',
      '  if (emitter) {',
      '    return emitter;',
      '  } else {',
      '    return undefined;',
      '  }',
      '}',
      '',
    ].join('\n');

    expect(await violations(SERVICE, code, RULES)).toEqual([
      {
        rule: 'no-restricted-imports',
        message: expect.stringContaining('Publish through EVENT_BUS') as string,
      },
      {
        rule: 'no-restricted-syntax',
        message: 'Use a guard clause / early return instead of else.',
      },
    ]);
  });
});
