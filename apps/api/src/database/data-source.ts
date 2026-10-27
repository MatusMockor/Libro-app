import { DataSource } from 'typeorm';
import { envFilePaths, WORKSPACE_ROOT } from '../config/env-file-paths.js';
import { loadEnv } from '../config/load-env.js';
import { cliDataSourceOptions } from './data-source.options.js';

const env = loadEnv(envFilePaths(process.env.NODE_ENV, WORKSPACE_ROOT));

export default new DataSource(cliDataSourceOptions(env.DATABASE_URL));
