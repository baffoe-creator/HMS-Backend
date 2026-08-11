import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('treatments', (table) => {
    table.increments('id').primary();
    table.integer('claim_id').unsigned().notNullable().references('id').inTable('claims').onDelete('CASCADE');
    table.date('date').notNullable();
    table.enum('type', ['Diagnosis', 'Procedure', 'Investigation']).notNullable();
    table.string('treatment_code', 100).notNullable();
    table.string('icd_code', 20);
    table.decimal('tariff', 12, 2).notNullable().defaultTo(0);
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('treatments');
}
