import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('patients', (table) => {
    // Idempotency key for the offline write queue (Step 2.3): lets the sync
    // endpoint recognize "this temp record was already reconciled" instead
    // of creating a duplicate on retry/replay.
    table.string('client_temp_id', 100).nullable().unique();

    // Set when the 24h emergency-completion check (Step 2.2) has flagged
    // this record as overdue, so it isn't re-flagged on every run.
    table.timestamp('emergency_flagged_at').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('patients', (table) => {
    table.dropColumn('client_temp_id');
    table.dropColumn('emergency_flagged_at');
  });
}
