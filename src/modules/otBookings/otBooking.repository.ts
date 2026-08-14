import { db } from '../../db/connection';

export interface OtBookingRecord {
  id: number;
  room_id: number;
  patient_id: number;
  surgeon_id: number;
  scheduled_start: string;
  scheduled_end: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export async function create(input: {
  roomId: number;
  patientId: number;
  surgeonId: number;
  scheduledStart: string;
  scheduledEnd: string;
}): Promise<OtBookingRecord> {
  const [id] = await db('ot_bookings').insert({
    room_id: input.roomId,
    patient_id: input.patientId,
    surgeon_id: input.surgeonId,
    scheduled_start: new Date(input.scheduledStart),
    scheduled_end: new Date(input.scheduledEnd),
    status: 'scheduled',
  });
  const created = await findById(id);
  if (!created) throw new Error('Failed to load newly created OT booking');
  return created;
}

export async function findById(id: number): Promise<OtBookingRecord | undefined> {
  return db<OtBookingRecord>('ot_bookings').where({ id }).first();
}

/**
 * Any scheduled booking in the same room whose window overlaps
 * [start, end). Standard interval-overlap test: two ranges overlap unless
 * one ends before the other starts.
 */
export async function findOverlapping(
  roomId: number,
  scheduledStart: string,
  scheduledEnd: string,
): Promise<OtBookingRecord | undefined> {
  return db<OtBookingRecord>('ot_bookings')
    .where('room_id', roomId)
    .andWhere('status', 'scheduled')
    .andWhere('scheduled_start', '<', new Date(scheduledEnd))
    .andWhere('scheduled_end', '>', new Date(scheduledStart))
    .first();
}
