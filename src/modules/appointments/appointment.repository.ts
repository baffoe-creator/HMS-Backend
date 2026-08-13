import { db } from '../../db/connection';

export interface AppointmentRecord {
  id: number;
  patient_id: number;
  doctor_id: number;
  appointment_time: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  created_at: string;
  updated_at: string;
}

export async function create(input: {
  patientId: number;
  doctorId: number;
  appointmentTime: string;
}): Promise<AppointmentRecord> {
  const [id] = await db('appointments').insert({
    patient_id: input.patientId,
    doctor_id: input.doctorId,
    // knex/mysql2 format a JS Date correctly for a DATETIME column; a raw
    // ISO string like '2026-09-01T09:00:00.000Z' is passed through as-is
    // and MySQL's strict mode rejects the 'T'/'Z' - hence converting here.
    appointment_time: new Date(input.appointmentTime),
    status: 'scheduled',
  });
  const created = await findById(id);
  if (!created) throw new Error('Failed to load newly created appointment');
  return created;
}

export async function findById(id: number): Promise<AppointmentRecord | undefined> {
  return db<AppointmentRecord>('appointments').where({ id }).first();
}

export async function findByDoctorAndTime(
  doctorId: number,
  appointmentTime: string,
): Promise<AppointmentRecord | undefined> {
  return db<AppointmentRecord>('appointments')
    .where('doctor_id', doctorId)
    .andWhere('appointment_time', new Date(appointmentTime))
    .whereIn('status', ['scheduled'])
    .first();
}

/** All scheduled appointment times for a doctor within a given [start, end) window. */
export async function findScheduledForDoctorInRange(
  doctorId: number,
  startIso: string,
  endIso: string,
): Promise<AppointmentRecord[]> {
  return db<AppointmentRecord>('appointments')
    .where({ doctor_id: doctorId, status: 'scheduled' })
    .andWhere('appointment_time', '>=', new Date(startIso))
    .andWhere('appointment_time', '<', new Date(endIso));
}
