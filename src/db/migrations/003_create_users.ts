import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('username', 100).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table
      .enum('role', [
        'admin',
        'receptionist',
        'clinician',
        'lab_tech',
        'pharmacy_tech',
        'accountant',
        'auditor',
      ])
      .notNullable();
    table.string('mfa_secret', 255).nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}
