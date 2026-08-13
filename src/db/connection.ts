import knex from 'knex';
import { env } from '../config/env';

/**
 * mysql2 returns TINYINT(1) (how knex stores booleans) as a raw 0/1 number
 * by default, not a JS boolean - so is_active, is_emergency, etc. would come
 * back from any query as 1/0 instead of true/false. This cast fixes that at
 * the connection level, once, instead of at every call site.
 */
function typeCast(field: { type: string; length: number; string: () => string }, next: () => unknown) {
  if (field.type === 'TINY' && field.length === 1) {
    return field.string() === '1';
  }
  return next();
}

export const db = knex({
  client: 'mysql2',
  connection: {
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.name,
    // Returns DATE/DATETIME columns as plain 'YYYY-MM-DD[ HH:MM:SS]' strings
    // instead of JS Date objects, matching the `string` types used throughout
    // the codebase (PatientRecord.dob, AppointmentRecord.appointment_time,
    // etc.) and avoiding silent type mismatches in equality comparisons.
    dateStrings: true,
    typeCast,
  },
  pool: { min: 1, max: 10 },
});