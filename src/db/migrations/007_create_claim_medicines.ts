import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('claim_medicines', (table) => {
    table.increments('id').primary();
    table.integer('claim_id').unsigned().notNullable().references('id').inTable('claims').onDelete('CASCADE');
    table.string('medicine_code', 100).notNullable();
    table.integer('quantity').unsigned().notNullable();
    table.decimal('unit_price', 12, 2).notNullable();
    table.decimal('medicine_total', 12, 2).notNullable();
    table.date('medicine_date').notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('claim_medicines');
}
