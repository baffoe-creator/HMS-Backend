import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('rooms_beds', (table) => {
    table.increments('id').primary();
    table.string('room_number', 50).notNullable();
    table.string('bed_number', 50).notNullable();
    table.enum('status', ['available', 'occupied', 'maintenance']).notNullable().defaultTo('available');
    table
      .integer('current_patient_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('patients')
      .onDelete('SET NULL');
    table.timestamps(true, true);

    table.unique(['room_number', 'bed_number'], { indexName: 'uq_room_bed' });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('rooms_beds');
}
