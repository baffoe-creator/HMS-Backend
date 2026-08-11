import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('providers', (table) => {
    table.increments('id').primary();
    table.string('accreditation_number', 100).notNullable().unique();
    table.string('eclaims_auth_number', 100).notNullable();
    table.string('name', 255).notNullable();
    table.string('address', 500);
    table.string('contact', 100);
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('providers');
}
