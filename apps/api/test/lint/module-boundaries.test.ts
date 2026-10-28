import { describe, expect, test } from 'vitest';
import { violations, type Violation } from './lint-source.js';

const RULES = ['boundaries/dependencies'];

const BOOKS_BOUNDARY: Violation = {
  rule: 'boundaries/dependencies',
  message:
    'Import the books module only through its public entry modules/books/index.ts (see Module conventions in CLAUDE.md).',
};

describe('module boundaries lint rule', () => {
  test.for([
    {
      case: 'a module importing an internal file of another module',
      path: 'apps/api/src/modules/shelf/application/shelf.service.ts',
      code: "import { WorkEntity } from '../../books/persistence/work.entity.js';\nexport const entity = WorkEntity;\n",
    },
    {
      case: 'a type-only import of an internal file of another module',
      path: 'apps/api/src/modules/shelf/application/shelf.service.ts',
      code: "import type { Work } from '../../books/domain/work.js';\nexport type ShelfWork = Work;\n",
    },
    {
      case: 'a re-export of an internal file of another module',
      path: 'apps/api/src/modules/shelf/index.ts',
      code: "export { BooksController } from '../books/http/books.controller.js';\n",
    },
    {
      case: 'code outside modules importing an internal file of a module',
      path: 'apps/api/src/app.module.ts',
      code: "import { TypeOrmWorkRepository } from './modules/books/persistence/typeorm-work.repository.js';\nexport const repository = TypeOrmWorkRepository;\n",
    },
  ])('rejects $case', async ({ path, code }) => {
    expect(await violations(path, code, RULES)).toEqual([BOOKS_BOUNDARY]);
  });

  test.for([
    {
      case: 'a module importing the public entry of another module',
      path: 'apps/api/src/modules/shelf/application/shelf.service.ts',
      code: "import { BOOK_CATALOGUE } from '../../books/index.js';\nexport const token = BOOK_CATALOGUE;\n",
    },
    {
      case: 'a module importing its own internal files',
      path: 'apps/api/src/modules/books/http/books.controller.ts',
      code: "import { WorkEntity } from '../persistence/work.entity.js';\nexport const entity = WorkEntity;\n",
    },
    {
      case: 'a module importing shared platform code',
      path: 'apps/api/src/modules/shelf/application/shelf.service.ts',
      code: "import { EVENT_BUS } from '../../../events/event-bus.js';\nexport const token = EVENT_BUS;\n",
    },
    {
      case: 'code outside modules importing the public entry of a module',
      path: 'apps/api/src/app.module.ts',
      code: "import { BooksModule } from './modules/books/index.js';\nexport const module = BooksModule;\n",
    },
  ])('allows $case', async ({ path, code }) => {
    expect(await violations(path, code, RULES)).toEqual([]);
  });
});
