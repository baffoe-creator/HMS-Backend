import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('action', 50).notNullable();
    table.string('table_name', 100).notNullable();
    table.string('record_id', 100).notNullable();
    table.json('before_state').nullable();
    table.json('after_state').nullable();
    table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());

    table.index(['table_name', 'record_id'], 'idx_audit_table_record');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_logs');
}
