import type { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';

const envFile = `.env.${process.env.NODE_ENV ?? 'development'}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const config: Knex.Config = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    user: process.env.DB_USER ?? 'hms_user',
    password: process.env.DB_PASSWORD ?? 'hms_password',
    database: process.env.DB_NAME ?? 'hms_dev',
  },
  migrations: {
    directory: path.resolve(__dirname, 'migrations'),
    extension: 'ts',
  },
  pool: { min: 2, max: 10 },
};

export default config;
