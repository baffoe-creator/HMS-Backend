import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('patients', (table) => {
    // Ciphertext lands here first, plaintext columns stay untouched until
    // 024 (expand/contract migration). See PHASE_7.1_ENCRYPTION_IMPLEMENTATION_SPEC.md.
    table.text('member_number_new').nullable();
    table.text('temp_card_number_new').nullable();
    table.text('card_serial_new').nullable();
    table.text('hospital_record_number_new').nullable();

    table.specificType('member_number_bidx', 'CHAR(64)').nullable();
    table.specificType('temp_card_number_bidx', 'CHAR(64)').nullable();
    table.specificType('card_serial_bidx', 'CHAR(64)').nullable();
    table.specificType('hospital_record_number_bidx', 'CHAR(64)').nullable();

    table.index('member_number_bidx', 'idx_patients_member_number_bidx');
    table.index('temp_card_number_bidx', 'idx_patients_temp_card_number_bidx');
    table.index('card_serial_bidx', 'idx_patients_card_serial_bidx');
  });

  // hospital_record_number's UNIQUE constraint lived on the plaintext column
  // (002_create_patients.ts). AES-GCM's random IV means the same plaintext
  // never produces the same ciphertext twice, so uniqueness has to move to
  // the deterministic blind index instead.
  await knex.schema.alterTable('patients', (table) => {
    table.unique('hospital_record_number_bidx', { indexName: 'uq_patients_hospital_record_number_bidx' });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('patients', (table) => {
    table.dropUnique(['hospital_record_number_bidx'], 'uq_patients_hospital_record_number_bidx');
    table.dropColumn('member_number_new');
    table.dropColumn('temp_card_number_new');
    table.dropColumn('card_serial_new');
    table.dropColumn('hospital_record_number_new');
    table.dropColumn('member_number_bidx');
    table.dropColumn('temp_card_number_bidx');
    table.dropColumn('card_serial_bidx');
    table.dropColumn('hospital_record_number_bidx');
  });
}