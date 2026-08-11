import { db } from '../src/db/connection';

/**
 * Step 0.2 test gate: confirms every table in the ERD (Technical Spec §9)
 * exists after running `npm run migrate:up`.
 *
 * Requires MySQL running (docker-compose up -d) and migrations applied
 * before this test is run.
 */
const EXPECTED_TABLES = [
  'providers',
  'patients',
  'users',
  'appointments',
  'claims',
  'treatments',
  'claim_medicines',
  'pharmacy_inventory',
  'lab_orders',
  'rooms_beds',
  'bills',
  'audit_logs',
  'icd_codes',
  'tariff_codes',
];

describe('Database schema (Step 0.2 gate)', () => {
  afterAll(async () => {
    await db.destroy();
  });

  it('contains every table defined in the ERD', async () => {
    const rows = await db('information_schema.tables')
      .select('table_name')
      .where('table_schema', db.client.config.connection.database);

    const actualTables = rows.map((r: { table_name: string; TABLE_NAME?: string }) =>
      (r.table_name ?? r.TABLE_NAME ?? '').toLowerCase(),
    );

    for (const expected of EXPECTED_TABLES) {
      expect(actualTables).toContain(expected);
    }
  });

  it('enforces the patients -> appointments foreign key', async () => {
    const fkRows = await db('information_schema.key_column_usage')
      .select('column_name', 'referenced_table_name')
      .where({
        table_schema: db.client.config.connection.database,
        table_name: 'appointments',
        referenced_table_name: 'patients',
      });

    expect(fkRows.length).toBeGreaterThan(0);
  });
});
