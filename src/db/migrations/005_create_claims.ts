import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('claims', (table) => {
    table.increments('id').primary();
    table.integer('patient_id').unsigned().notNullable().references('id').inTable('patients').onDelete('RESTRICT');
    table.integer('provider_id').unsigned().notNullable().references('id').inTable('providers').onDelete('RESTRICT');
    table.string('claim_identification_number', 100).notNullable().unique();
    table.enum('service_type', ['OUT', 'INP', 'CAP']).notNullable();
    table.boolean('pharmacy_included').notNullable().defaultTo(false);
    table.boolean('all_inclusive').notNullable().defaultTo(false);
    table.string('outcome_type', 50);
    table.date('admission_date').nullable();
    table.date('discharge_date').nullable();
    table.decimal('total_cost', 12, 2).notNullable().defaultTo(0);
    table.string('referral_no', 100).nullable();
    table
      .enum('status', ['draft', 'submitted', 'accepted', 'rejected', 'adjusted'])
      .notNullable()
      .defaultTo('draft');
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('claims');
}
