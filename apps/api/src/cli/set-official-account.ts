import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { OFFICIAL_ACCOUNTS, type OfficialAccounts } from '../modules/profiles/index.js';
import {
  OFFICIAL_ACCOUNT_USAGE,
  parseOfficialAccountCommand,
  runOfficialAccountCommand,
  type CommandResult,
  type OfficialAccountCommand,
} from './official-account-command.js';

const logger = new Logger('SetOfficialAccount');

async function run(command: OfficialAccountCommand | undefined): Promise<CommandResult> {
  if (!command) {
    return { exitCode: 1, message: OFFICIAL_ACCOUNT_USAGE };
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    return await runOfficialAccountCommand(app.get<OfficialAccounts>(OFFICIAL_ACCOUNTS), command);
  } finally {
    await app.close();
  }
}

function report({ exitCode, message }: CommandResult): void {
  process.exitCode = exitCode;
  if (exitCode !== 0) {
    logger.error(message);
    return;
  }

  logger.log(message);
}

report(await run(parseOfficialAccountCommand(process.argv.slice(2))));
