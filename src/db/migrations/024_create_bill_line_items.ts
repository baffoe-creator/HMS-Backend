import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('bill_line_items', (table) => {
    table.increments('id').primary();
    table.integer('bill_id').unsigned().notNullable().references('id').inTable('bills').onDelete('CASCADE');
    table.string('description', 255).notNullable();
    table.decimal('amount', 12, 2).notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('bill_line_items');
}
