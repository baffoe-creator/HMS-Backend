import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('patients', (table) => {
    table.increments('id').primary();
    table.string('surname', 100).notNullable();
    table.string('other_name', 100).notNullable();
    table.date('dob');
    table.string('gender', 20).notNullable();
    table.string('member_number', 100);
    table.string('temp_card_number', 100);
    table.string('card_serial', 100);
    table.string('hospital_record_number', 100).unique();
    table.boolean('is_infant').notNullable().defaultTo(false);
    table.boolean('is_emergency').notNullable().defaultTo(false);
    table.timestamp('emergency_completed_at').nullable();
    table.timestamps(true, true);

    table.index(['surname', 'other_name', 'dob'], 'idx_patients_duplicate_check');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('patients');
}
