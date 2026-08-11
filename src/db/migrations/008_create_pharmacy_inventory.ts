import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('pharmacy_inventory', (table) => {
    table.increments('id').primary();
    table.string('medicine_code', 100).notNullable().unique();
    table.string('name', 255).notNullable();
    table.integer('stock_qty').unsigned().notNullable().defaultTo(0);
    table.integer('reorder_level').unsigned().notNullable().defaultTo(0);
    table.decimal('unit_cost', 12, 2).notNullable().defaultTo(0);
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('pharmacy_inventory');
}
