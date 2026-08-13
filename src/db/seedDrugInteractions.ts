import { db } from './connection';

/**
 * Starter drug-interaction pairs for local testing. Not a clinically
 * exhaustive interaction database - a real deployment needs a proper
 * pharmacology reference source. Run with: npm run seed:drug-interactions
 */
const STARTER_INTERACTIONS = [
  {
    medicineCodeA: 'WARFARIN',
    medicineCodeB: 'ASPIRIN',
    severity: 'severe' as const,
    description: 'Increased risk of bleeding when combined',
  },
  {
    medicineCodeA: 'METFORMIN',
    medicineCodeB: 'CONTRAST-DYE',
    severity: 'moderate' as const,
    description: 'Risk of lactic acidosis - hold metformin around contrast imaging',
  },
];

async function main() {
  let inserted = 0;
  let skipped = 0;

  for (const entry of STARTER_INTERACTIONS) {
    const existing = await db('drug_interactions')
      .where({ medicine_code_a: entry.medicineCodeA, medicine_code_b: entry.medicineCodeB })
      .first();
    if (existing) {
      skipped += 1;
      continue;
    }
    await db('drug_interactions').insert({
      medicine_code_a: entry.medicineCodeA,
      medicine_code_b: entry.medicineCodeB,
      severity: entry.severity,
      description: entry.description,
    });
    inserted += 1;
  }

  console.log(`Drug interaction seed complete: ${inserted} inserted, ${skipped} already present.`);
  await db.destroy();
}

main().catch((err) => {
  console.error('Drug interaction seed script failed:', err);
  process.exit(1);
});
