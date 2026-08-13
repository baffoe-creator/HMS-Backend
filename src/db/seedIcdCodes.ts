import { db } from './connection';

/**
 * Step 3.1: seeds a small starter set of ICD-10 codes. This is NOT the full
 * NHIA/WHO code list - a real deployment needs the complete official set
 * imported (likely from an NHIA-provided file). This starter set exists so
 * the lookup/versioning endpoints have real data to work against locally.
 * Run with: npm run seed:icd-codes
 */
const STARTER_CODES = [
  { code: 'A00', description: 'Cholera' },
  { code: 'E11', description: 'Type 2 diabetes mellitus' },
  { code: 'I10', description: 'Essential (primary) hypertension' },
  { code: 'J18', description: 'Pneumonia, unspecified organism' },
  { code: 'J45', description: 'Asthma' },
  { code: 'K29', description: 'Gastritis and duodenitis' },
  { code: 'O80', description: 'Single spontaneous delivery' },
  { code: 'S72', description: 'Fracture of femur' },
  { code: 'B54', description: 'Unspecified malaria' },
  { code: 'N39', description: 'Other disorders of urinary system' },
];

const VERSION = 'ICD-10-STARTER-2026';

async function main() {
  let inserted = 0;
  let skipped = 0;

  for (const entry of STARTER_CODES) {
    const existing = await db('icd_codes').where({ code: entry.code, version: VERSION }).first();
    if (existing) {
      skipped += 1;
      continue;
    }
    await db('icd_codes').insert({
      code: entry.code,
      description: entry.description,
      version: VERSION,
      is_active: true,
    });
    inserted += 1;
  }

  console.log(`ICD seed complete: ${inserted} inserted, ${skipped} already present.`);
  await db.destroy();
}

main().catch((err) => {
  console.error('ICD seed script failed:', err);
  process.exit(1);
});
