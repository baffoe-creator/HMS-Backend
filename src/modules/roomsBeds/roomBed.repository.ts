import { db } from '../../db/connection';

export type RoomStatus = 'available' | 'occupied' | 'maintenance';
export type RoomType = 'ward' | 'ot';

export interface RoomBedRecord {
  id: number;
  room_number: string;
  bed_number: string;
  status: RoomStatus;
  room_type: RoomType;
  current_patient_id: number | null;
  created_at: string;
  updated_at: string;
}

export async function findById(id: number): Promise<RoomBedRecord | undefined> {
  return db<RoomBedRecord>('rooms_beds').where({ id }).first();
}

export async function create(input: {
  roomNumber: string;
  bedNumber: string;
  roomType?: RoomType;
}): Promise<RoomBedRecord> {
  const [id] = await db('rooms_beds').insert({
    room_number: input.roomNumber,
    bed_number: input.bedNumber,
    room_type: input.roomType ?? 'ward',
    status: 'available',
  });
  const created = await findById(id);
  if (!created) throw new Error('Failed to load newly created room/bed');
  return created;
}

export async function admit(bedId: number, patientId: number): Promise<number> {
  // Guard the status in the WHERE clause itself, not just in application code -
  // this makes the check-then-set atomic at the DB level, closing the race
  // window two concurrent admit requests could otherwise slip through.
  return db('rooms_beds')
    .where({ id: bedId, status: 'available' })
    .update({ status: 'occupied', current_patient_id: patientId });
}

export async function discharge(bedId: number): Promise<number> {
  return db('rooms_beds')
    .where({ id: bedId, status: 'occupied' })
    .update({ status: 'available', current_patient_id: null });
}
