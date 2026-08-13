import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('prescriptions', (table) => {
    table.increments('id').primary();
    table.integer('patient_id').unsigned().notNullable().references('id').inTable('patients').onDelete('CASCADE');
    table.integer('clinician_id').unsigned().notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.string('medicine_code', 100).notNullable();
    table.string('dosage', 100).notNullable();
    table.text('instructions').nullable();
    table.enum('status', ['active', 'completed', 'cancelled']).notNullable().defaultTo('active');
    table.date('prescribed_date').notNullable();
    table.timestamps(true, true);

    table.index(['patient_id', 'status'], 'idx_prescriptions_patient_status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('prescriptions');
}
