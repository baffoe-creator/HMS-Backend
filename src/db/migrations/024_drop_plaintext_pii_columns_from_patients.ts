import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('patients', (table) => {
    table.dropColumn('member_number');
    table.dropColumn('temp_card_number');
    table.dropColumn('card_serial');
    table.dropColumn('hospital_record_number');
  });
  await knex.schema.raw('ALTER TABLE patients RENAME COLUMN member_number_new TO member_number');
  await knex.schema.raw('ALTER TABLE patients RENAME COLUMN temp_card_number_new TO temp_card_number');
  await knex.schema.raw('ALTER TABLE patients RENAME COLUMN card_serial_new TO card_serial');
  await knex.schema.raw('ALTER TABLE patients RENAME COLUMN hospital_record_number_new TO hospital_record_number');
}

export async function down(_knex: Knex): Promise<void> {
  throw new Error('024 is not reversible: original plaintext PII was dropped. Restore from backup instead.');
}