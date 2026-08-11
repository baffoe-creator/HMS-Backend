import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('bills', (table) => {
    table.increments('id').primary();
    table.integer('patient_id').unsigned().notNullable().references('id').inTable('patients').onDelete('RESTRICT');
    table.integer('claim_id').unsigned().nullable().references('id').inTable('claims').onDelete('SET NULL');
    table.decimal('total_amount', 12, 2).notNullable().defaultTo(0);
    table.enum('paid_status', ['unpaid', 'partial', 'paid']).notNullable().defaultTo('unpaid');
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('bills');
}
