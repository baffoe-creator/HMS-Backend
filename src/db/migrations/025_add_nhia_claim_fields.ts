import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // service_type was missing 'DIA' (diagnostic) - the real NHIA spec (§Appendix X.1,
  // ServiceType) lists OUT/INP/DIA/CAP as the four valid values.
  await knex.raw(
    "ALTER TABLE claims MODIFY COLUMN service_type ENUM('OUT','INP','DIA','CAP') NOT NULL",
  );

  await knex.schema.alterTable('claims', (table) => {
    table.integer('duration_length').unsigned().nullable();
    table.enum('admission_type', ['CRO', 'EME', 'ACU']).nullable();
    table.string('speciality_code', 25).nullable();
    table.decimal('out_patient_tariff_amount', 15, 2).nullable();
    table.decimal('in_patient_tariff_amount', 15, 2).nullable();
    table.string('out_patient_code', 100).nullable();
    table.string('in_patient_code', 100).nullable();
    table.string('investigation_code', 100).nullable();
    table.string('claim_check_code', 13).nullable();

    // Populated from Feedback XML ingestion (Step 6.4)
    table.string('nhia_error_code', 10).nullable();
    table.string('nhia_reason_code', 10).nullable();
    table.decimal('nhia_adjustment_value', 15, 2).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('claims', (table) => {
    table.dropColumn('duration_length');
    table.dropColumn('admission_type');
    table.dropColumn('speciality_code');
    table.dropColumn('out_patient_tariff_amount');
    table.dropColumn('in_patient_tariff_amount');
    table.dropColumn('out_patient_code');
    table.dropColumn('in_patient_code');
    table.dropColumn('investigation_code');
    table.dropColumn('claim_check_code');
    table.dropColumn('nhia_error_code');
    table.dropColumn('nhia_reason_code');
    table.dropColumn('nhia_adjustment_value');
  });

  await knex.raw("ALTER TABLE claims MODIFY COLUMN service_type ENUM('OUT','INP','CAP') NOT NULL");
}
