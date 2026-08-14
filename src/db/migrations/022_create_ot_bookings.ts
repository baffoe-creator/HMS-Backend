import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('ot_bookings', (table) => {
    table.increments('id').primary();
    table.integer('room_id').unsigned().notNullable().references('id').inTable('rooms_beds').onDelete('RESTRICT');
    table.integer('patient_id').unsigned().notNullable().references('id').inTable('patients').onDelete('RESTRICT');
    table.integer('surgeon_id').unsigned().notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.datetime('scheduled_start').notNullable();
    table.datetime('scheduled_end').notNullable();
    table.enum('status', ['scheduled', 'completed', 'cancelled']).notNullable().defaultTo('scheduled');
    table.timestamps(true, true);

    table.index(['room_id', 'scheduled_start', 'scheduled_end'], 'idx_ot_bookings_room_window');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ot_bookings');
}
