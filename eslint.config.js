import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const EVENTS_TRANSPORT_MESSAGE =
  'Publish through EVENT_BUS and handle with @OnDomainEvent from src/events.';

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
      'no-restricted-syntax': [
        'error',
        {
          selector: 'IfStatement[alternate]',
          message: 'Use a guard clause / early return instead of else.',
        },
      ],
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
  {
    files: ['apps/api/**/*.ts'],
    ignores: ['apps/api/src/events/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
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
        },
      ],
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
