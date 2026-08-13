import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('patient_allergies', (table) => {
    table.increments('id').primary();
    table.integer('patient_id').unsigned().notNullable().references('id').inTable('patients').onDelete('CASCADE');
    table.string('allergen', 100).notNullable();
    table.text('notes').nullable();
    table.timestamps(true, true);

    table.index(['patient_id', 'allergen'], 'idx_patient_allergies_lookup');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('patient_allergies');
}
