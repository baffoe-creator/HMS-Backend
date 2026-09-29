import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('dispenses', (table) => {
    table.increments('id').primary();
    table.integer('prescription_id').unsigned().notNullable().references('id').inTable('prescriptions').onDelete('RESTRICT');
    table.integer('pharmacy_tech_id').unsigned().notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.integer('quantity').unsigned().notNullable();
    table.decimal('unit_price', 12, 2).notNullable();
    table.decimal('total_price', 12, 2).notNullable();
    table.datetime('dispensed_at').notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('dispenses');
}
