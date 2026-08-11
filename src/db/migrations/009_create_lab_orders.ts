import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('lab_orders', (table) => {
    table.increments('id').primary();
    table.integer('patient_id').unsigned().notNullable().references('id').inTable('patients').onDelete('CASCADE');
    table.string('test_type', 255).notNullable();
    table.integer('ordered_by').unsigned().notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.text('result').nullable();
    table
      .enum('status', ['ordered', 'in_progress', 'completed', 'cancelled'])
      .notNullable()
      .defaultTo('ordered');
    table.date('ordered_date').notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('lab_orders');
}
