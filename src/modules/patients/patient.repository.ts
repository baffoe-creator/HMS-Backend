import { db } from '../../db/connection';
import { encryptField, decryptField, blindIndex } from '../../utils/encryption';

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
    member_number: encryptField(input.memberNumber ?? null),
    member_number_bidx: blindIndex(input.memberNumber ?? null),
    temp_card_number: encryptField(input.tempCardNumber ?? null),
    temp_card_number_bidx: blindIndex(input.tempCardNumber ?? null),
    card_serial: encryptField(input.cardSerial ?? null),
    card_serial_bidx: blindIndex(input.cardSerial ?? null),
    hospital_record_number: encryptField(input.hospitalRecordNumber ?? null),
    hospital_record_number_bidx: blindIndex(input.hospitalRecordNumber ?? null),
    is_infant: input.isInfant ?? false,
    is_emergency: input.isEmergency ?? false,
    client_temp_id: input.clientTempId ?? null,
  };
}

/**
 * Decrypts the four PII columns off a raw row. Throws DecryptionError
 * upward on corrupted/tampered ciphertext rather than swallowing it —
 * a silently-null PII field on a hospital record is worse than a loud
 * 500. Callers (service/controller layer) decide how to surface that.
 */
function fromRow(row: Record<string, unknown>): PatientRecord {
  return {
    id: row.id as number,
    surname: row.surname as string,
    other_name: row.other_name as string,
    dob: row.dob as string | null,
    gender: row.gender as string,
    member_number: decryptField(row.member_number as string | null),
    temp_card_number: decryptField(row.temp_card_number as string | null),
    card_serial: decryptField(row.card_serial as string | null),
    hospital_record_number: decryptField(row.hospital_record_number as string | null),
    is_infant: row.is_infant as boolean,
    is_emergency: row.is_emergency as boolean,
    emergency_completed_at: row.emergency_completed_at as string | null,
    emergency_flagged_at: row.emergency_flagged_at as string | null,
    client_temp_id: row.client_temp_id as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function create(input: CreatePatientInput): Promise<PatientRecord> {
  const [id] = await db('patients').insert(toRow(input));
  const created = await findById(id);
  if (!created) throw new Error('Failed to load newly created patient');
  return created;
}

export async function findById(id: number): Promise<PatientRecord | undefined> {
  const row = await db('patients').where({ id }).first();
  return row ? fromRow(row) : undefined;
}

export async function findByClientTempId(clientTempId: string): Promise<PatientRecord | undefined> {
  const row = await db('patients').where({ client_temp_id: clientTempId }).first();
  return row ? fromRow(row) : undefined;
}

/**
 * Step 2.1 duplicate-detection: unchanged from before Phase 7.1. Matches on
 * plaintext surname + other_name + dob — those columns are out of scope for
 * encryption (see spec: duplicate detection and clinical queries need them
 * searchable in plain form).
 */
export async function findPossibleDuplicate(
  surname: string,
  otherName: string,
  dob: string | null,
): Promise<PatientRecord | undefined> {
  const query = db('patients').where({ surname, other_name: otherName });
  if (dob) {
    query.andWhere({ dob });
  } else {
    query.whereNull('dob');
  }
  const row = await query.first();
  return row ? fromRow(row) : undefined;
}

/** New in Phase 7.1: exact lookup via blind index. Use this — never a raw
 * WHERE on the ciphertext columns — once claims/billing code needs to find
 * a patient by these identifiers. */
export async function findByHospitalRecordNumber(value: string): Promise<PatientRecord | undefined> {
  const row = await db('patients').where({ hospital_record_number_bidx: blindIndex(value) }).first();
  return row ? fromRow(row) : undefined;
}

export async function findByMemberNumber(value: string): Promise<PatientRecord | undefined> {
  const row = await db('patients').where({ member_number_bidx: blindIndex(value) }).first();
  return row ? fromRow(row) : undefined;
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
  if (fields.memberNumber !== undefined) {
    row.member_number = encryptField(fields.memberNumber);
    row.member_number_bidx = blindIndex(fields.memberNumber);
  }
  if (fields.tempCardNumber !== undefined) {
    row.temp_card_number = encryptField(fields.tempCardNumber);
    row.temp_card_number_bidx = blindIndex(fields.tempCardNumber);
  }
  if (fields.cardSerial !== undefined) {
    row.card_serial = encryptField(fields.cardSerial);
    row.card_serial_bidx = blindIndex(fields.cardSerial);
  }
  if (fields.hospitalRecordNumber !== undefined) {
    row.hospital_record_number = encryptField(fields.hospitalRecordNumber);
    row.hospital_record_number_bidx = blindIndex(fields.hospitalRecordNumber);
  }
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
  const rows = await db('patients')
    .where({ is_emergency: true, emergency_flagged_at: null })
    .whereNull('emergency_completed_at');
  return rows.map(fromRow);
}

export async function flagOverdue(id: number): Promise<void> {
  await db('patients').where({ id }).update({ emergency_flagged_at: db.fn.now() });
}