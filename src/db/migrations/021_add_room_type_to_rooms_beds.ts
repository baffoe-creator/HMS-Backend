import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('rooms_beds', (table) => {
    table.enum('room_type', ['ward', 'ot']).notNullable().defaultTo('ward');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('rooms_beds', (table) => {
    table.dropColumn('room_type');
  });
}
