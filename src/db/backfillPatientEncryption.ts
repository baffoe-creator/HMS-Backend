import { db } from './connection';
import { encryptField, blindIndex } from '../utils/encryption';

/**
 * Phase 7.1: encrypts existing plaintext PII into the *_new / *_bidx columns
 * added by migration 023. Idempotent — safe to re-run; rows already
 * backfilled are skipped. Run with: npm run backfill:patient-encryption
 */
const BATCH_SIZE = 500;

async function main() {
  let processed = 0;
  let encrypted = 0;

  for (;;) {
    const batch = await db('patients')
      .select('id', 'member_number', 'temp_card_number', 'card_serial', 'hospital_record_number')
      .whereNull('member_number_new')
      .andWhere((qb) => {
        qb.whereNotNull('member_number')
          .orWhereNotNull('temp_card_number')
          .orWhereNotNull('card_serial')
          .orWhereNotNull('hospital_record_number');
      })
      .limit(BATCH_SIZE);

    if (batch.length === 0) break;

    for (const row of batch) {
      await db('patients')
        .where({ id: row.id })
        .update({
          member_number_new: encryptField(row.member_number),
          member_number_bidx: blindIndex(row.member_number),
          temp_card_number_new: encryptField(row.temp_card_number),
          temp_card_number_bidx: blindIndex(row.temp_card_number),
          card_serial_new: encryptField(row.card_serial),
          card_serial_bidx: blindIndex(row.card_serial),
          hospital_record_number_new: encryptField(row.hospital_record_number),
          hospital_record_number_bidx: blindIndex(row.hospital_record_number),
        });
      encrypted += 1;
    }

    processed += batch.length;
    console.log(`Backfilled ${processed} rows so far...`);
  }

  // Rows with all four source fields null never match the WHERE above and
  // would be rescanned forever — mark them processed with a harmless no-op
  // write so the loop terminates.
  await db('patients')
    .whereNull('member_number_new')
    .whereNull('member_number')
    .whereNull('temp_card_number')
    .whereNull('card_serial')
    .whereNull('hospital_record_number')
    .update({ member_number_bidx: null });

  console.log(`Backfill complete: ${encrypted} rows encrypted, ${processed} total scanned.`);
  await db.destroy();
}

main().catch((err) => {
  console.error('Backfill script failed:', err);
  process.exit(1);
});