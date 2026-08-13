import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('drug_interactions', (table) => {
    table.increments('id').primary();
    table.string('medicine_code_a', 100).notNullable();
    table.string('medicine_code_b', 100).notNullable();
    table.enum('severity', ['minor', 'moderate', 'severe']).notNullable().defaultTo('moderate');
    table.string('description', 500).notNullable();
    table.timestamps(true, true);

    table.unique(['medicine_code_a', 'medicine_code_b'], { indexName: 'uq_drug_interaction_pair' });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('drug_interactions');
}
