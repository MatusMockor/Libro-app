import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { WORKSPACE_ROOT } from '../../src/config/env-file-paths.js';

export interface Violation {
  readonly rule: string | null;
  readonly message: string;
}

const eslint = new ESLint({
  cwd: WORKSPACE_ROOT,
  overrideConfig: tseslint.configs.disableTypeChecked,
});

export async function violations(
  path: string,
  code: string,
  rules: readonly string[],
): Promise<Violation[]> {
  const results = await eslint.lintText(code, { filePath: resolve(WORKSPACE_ROOT, path) });

  return results
    .flatMap((result) => result.messages)
    .filter(({ ruleId }) => ruleId === null || rules.includes(ruleId))
    .map(({ ruleId, message }) => ({ rule: ruleId, message }));
}
