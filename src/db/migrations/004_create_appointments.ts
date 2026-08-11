import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('appointments', (table) => {
    table.increments('id').primary();
    table.integer('patient_id').unsigned().notNullable().references('id').inTable('patients').onDelete('CASCADE');
    table.integer('doctor_id').unsigned().notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.datetime('appointment_time').notNullable();
    table.enum('status', ['scheduled', 'completed', 'cancelled', 'no_show']).notNullable().defaultTo('scheduled');
    table.timestamps(true, true);

    table.index(['doctor_id', 'appointment_time'], 'idx_appointments_doctor_time');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('appointments');
}
