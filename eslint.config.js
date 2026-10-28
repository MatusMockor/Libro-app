import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const EVENTS_TRANSPORT_MESSAGE =
  'Publish through EVENT_BUS and handle with @OnDomainEvent from src/events.';

const MODULE_BOUNDARY_MESSAGE =
  'Import the {{to.element.captured.module}} module only through its public entry modules/{{to.element.captured.module}}/index.ts (see Module conventions in CLAUDE.md).';

const DATABASE_ACCESS_MESSAGE =
  'Database access belongs in a repository class (*.repository.ts); depend on its interface token instead (see Module conventions in CLAUDE.md).';

const NO_ELSE = {
  selector: 'IfStatement[alternate]',
  message: 'Use a guard clause / early return instead of else.',
};

const EVENTS_TRANSPORT_IMPORTS = {
  paths: ['@nestjs/event-emitter', 'eventemitter2'].map((name) => ({
    name,
    message: EVENTS_TRANSPORT_MESSAGE,
  })),
  patterns: [
    {
      group: ['@nestjs/event-emitter/*', 'eventemitter2/*'],
      message: EVENTS_TRANSPORT_MESSAGE,
    },
  ],
};

const REQUIRE_MESSAGE = 'Use an ES module import instead of require().';

const DATABASE_ACCESS_PACKAGES = [
  {
    name: 'typeorm',
    importNames: [
      'DataSource',
      'EntityManager',
      'QueryRunner',
      'Repository',
      'TreeRepository',
      'QueryBuilder',
      'SelectQueryBuilder',
      'InsertQueryBuilder',
      'UpdateQueryBuilder',
      'DeleteQueryBuilder',
      'RelationQueryBuilder',
    ],
  },
  {
    name: '@nestjs/typeorm',
    importNames: ['InjectRepository', 'InjectDataSource', 'InjectEntityManager'],
  },
];

const DATABASE_ACCESS_IMPORTS = {
  paths: DATABASE_ACCESS_PACKAGES.map(({ name, importNames }) => ({
    name,
    importNames,
    message: DATABASE_ACCESS_MESSAGE,
  })),
  patterns: DATABASE_ACCESS_PACKAGES.map(({ name, importNames }) => ({
    group: [`${name}/*`],
    importNames,
    message: DATABASE_ACCESS_MESSAGE,
  })),
};

const DATABASE_ACCESS_METHODS = '/^(createQueryBuilder|query|transaction)$/';
const DATABASE_ACCESS_MODULES = '/^(typeorm|@nestjs.typeorm)($|[^a-z-])/';

const DATABASE_ACCESS_SYNTAX = [
  `CallExpression[callee.computed=false][callee.property.name=${DATABASE_ACCESS_METHODS}]`,
  `CallExpression[callee.computed=true][callee.property.value=${DATABASE_ACCESS_METHODS}]`,
  "MemberExpression[computed=false][property.name='manager']",
  "MemberExpression[computed=true][property.value='manager']",
  "ObjectPattern > Property[computed=false][key.name='manager']",
  "ObjectPattern > Property[computed=false][key.value='manager']",
  `ImportExpression[source.value=${DATABASE_ACCESS_MODULES}]`,
]
  .map((selector) => ({ selector, message: DATABASE_ACCESS_MESSAGE }))
  .concat({ selector: "CallExpression[callee.name='require']", message: REQUIRE_MESSAGE });

export default defineConfig(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/.turbo/**', '**/node_modules/**'],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-restricted-syntax': ['error', NO_ELSE],
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
  {
    files: ['apps/api/**/*.ts'],
    ignores: ['apps/api/src/events/**'],
    rules: {
      'no-restricted-imports': ['error', EVENTS_TRANSPORT_IMPORTS],
    },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/root-path': import.meta.dirname,
      'boundaries/elements': [
        { type: 'module', pattern: 'apps/api/src/modules/*', capture: ['module'] },
        { type: 'platform', pattern: 'apps/api/src' },
      ],
      'import/resolver': {
        typescript: { project: `${import.meta.dirname}/apps/api/tsconfig.json` },
      },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            {
              disallow: { to: { element: { type: 'module', fileInternalPath: '!index.ts' } } },
              message: MODULE_BOUNDARY_MESSAGE,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/modules/**/*.ts'],
    ignores: [
      'apps/api/src/modules/**/*.repository.ts',
      'apps/api/src/modules/**/seeds/**',
      'apps/api/src/modules/**/factories/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...EVENTS_TRANSPORT_IMPORTS.paths, ...DATABASE_ACCESS_IMPORTS.paths],
          patterns: [...EVENTS_TRANSPORT_IMPORTS.patterns, ...DATABASE_ACCESS_IMPORTS.patterns],
        },
      ],
      'no-restricted-syntax': ['error', NO_ELSE, ...DATABASE_ACCESS_SYNTAX],
    },
  },
  {
    files: ['**/test/**/*.ts'],
    rules: {
      'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }],
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
