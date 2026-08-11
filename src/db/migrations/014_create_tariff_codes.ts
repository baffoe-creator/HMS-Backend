import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('tariff_codes', (table) => {
    table.increments('id').primary();
    table.string('code', 20).notNullable();
    table.string('description', 500).notNullable();
    table.decimal('tariff_amount', 12, 2).notNullable();
    table.string('version', 20).notNullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.unique(['code', 'version'], { indexName: 'uq_tariff_code_version' });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('tariff_codes');
}
