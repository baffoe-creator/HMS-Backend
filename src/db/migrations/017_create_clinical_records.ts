import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('clinical_records', (table) => {
    table.increments('id').primary();
    table.integer('patient_id').unsigned().notNullable().references('id').inTable('patients').onDelete('CASCADE');
    table.integer('clinician_id').unsigned().notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.json('vitals').nullable();
    table.text('history').nullable();
    table.string('diagnosis_icd_code', 20).nullable();
    table.text('notes').nullable();
    table.date('encounter_date').notNullable();
    table.timestamps(true, true);

    table.index(['patient_id', 'encounter_date'], 'idx_clinical_records_patient_date');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('clinical_records');
}
