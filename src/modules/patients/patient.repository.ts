import { db } from '../../db/connection';

export interface PatientRecord {
  id: number;
  surname: string;
  other_name: string;
  dob: string | null;
  gender: string;
  member_number: string | null;
  temp_card_number: string | null;
  card_serial: string | null;
  hospital_record_number: string | null;
  is_infant: boolean;
  is_emergency: boolean;
  emergency_completed_at: string | null;
  emergency_flagged_at: string | null;
  client_temp_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePatientInput {
  surname: string;
  otherName: string;
  dob?: string | null;
  gender: string;
  memberNumber?: string | null;
  tempCardNumber?: string | null;
  cardSerial?: string | null;
  hospitalRecordNumber?: string | null;
  isInfant?: boolean;
  isEmergency?: boolean;
  clientTempId?: string | null;
}

function toRow(input: CreatePatientInput) {
  return {
    surname: input.surname,
    other_name: input.otherName,
    dob: input.dob ?? null,
    gender: input.gender,
    member_number: input.memberNumber ?? null,
    temp_card_number: input.tempCardNumber ?? null,
    card_serial: input.cardSerial ?? null,
    hospital_record_number: input.hospitalRecordNumber ?? null,
    is_infant: input.isInfant ?? false,
    is_emergency: input.isEmergency ?? false,
    client_temp_id: input.clientTempId ?? null,
  };
}

export async function create(input: CreatePatientInput): Promise<PatientRecord> {
  const [id] = await db('patients').insert(toRow(input));
  const created = await findById(id);
  if (!created) throw new Error('Failed to load newly created patient');
  return created;
}

export async function findById(id: number): Promise<PatientRecord | undefined> {
  return db<PatientRecord>('patients').where({ id }).first();
}

export async function findByClientTempId(clientTempId: string): Promise<PatientRecord | undefined> {
  return db<PatientRecord>('patients').where({ client_temp_id: clientTempId }).first();
}

/**
 * Step 2.1 duplicate-detection: exact match on surname + other_name + dob.
 * Deliberately loose (no fuzzy matching) - a real system would layer in
 * phonetic/fuzzy matching later, but exact-match on the indexed columns is
 * the correct Phase 2 scope.
 */
export async function findPossibleDuplicate(
  surname: string,
  otherName: string,
  dob: string | null,
): Promise<PatientRecord | undefined> {
  const query = db<PatientRecord>('patients').where({ surname, other_name: otherName });
  if (dob) {
    query.andWhere({ dob });
  } else {
    query.whereNull('dob');
  }
  return query.first();
}

export async function update(
  id: number,
  fields: Partial<CreatePatientInput>,
): Promise<PatientRecord | undefined> {
  const row: Record<string, unknown> = {};
  if (fields.surname !== undefined) row.surname = fields.surname;
  if (fields.otherName !== undefined) row.other_name = fields.otherName;
  if (fields.dob !== undefined) row.dob = fields.dob;
  if (fields.gender !== undefined) row.gender = fields.gender;
  if (fields.memberNumber !== undefined) row.member_number = fields.memberNumber;
  if (fields.tempCardNumber !== undefined) row.temp_card_number = fields.tempCardNumber;
  if (fields.cardSerial !== undefined) row.card_serial = fields.cardSerial;
  if (fields.hospitalRecordNumber !== undefined) row.hospital_record_number = fields.hospitalRecordNumber;
  if (fields.isInfant !== undefined) row.is_infant = fields.isInfant;

  if (Object.keys(row).length > 0) {
    await db('patients').where({ id }).update(row);
  }
  return findById(id);
}

export async function remove(id: number): Promise<number> {
  return db('patients').where({ id }).del();
}

export async function markEmergencyCompleted(id: number): Promise<void> {
  await db('patients').where({ id }).update({
    is_emergency: false,
    emergency_completed_at: db.fn.now(),
  });
}

/** All emergency patients not yet completed and not yet flagged - Step 2.2 monitor input. */
export async function findUnflaggedIncompleteEmergencyPatients(): Promise<PatientRecord[]> {
  return db<PatientRecord>('patients')
    .where({ is_emergency: true, emergency_flagged_at: null })
    .whereNull('emergency_completed_at');
}

export async function flagOverdue(id: number): Promise<void> {
  await db('patients').where({ id }).update({ emergency_flagged_at: db.fn.now() });
}
