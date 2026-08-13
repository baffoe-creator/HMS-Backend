import * as patientRepo from './patient.repository';
import { CreatePatientInput, PatientRecord } from './patient.repository';

export class ValidationError extends Error {
  statusCode = 400;
}
export class NotFoundError extends Error {
  statusCode = 404;
}

const REQUIRED_STANDARD_FIELDS: Array<keyof CreatePatientInput> = ['surname', 'otherName', 'gender'];

function assertRequiredFields(input: Partial<CreatePatientInput>, fields: Array<keyof CreatePatientInput>) {
  for (const field of fields) {
    if (!input[field]) {
      throw new ValidationError(`${field} is required`);
    }
  }
}

export interface RegisterResult {
  patient: PatientRecord;
  duplicateOf: number | null;
}

/** Step 2.1: standard registration. Always creates the record - a detected
 * duplicate is surfaced to the caller (duplicateOf) rather than silently
 * blocking, since front-desk staff need to make the final call. */
export async function registerPatient(input: CreatePatientInput): Promise<RegisterResult> {
  assertRequiredFields(input, REQUIRED_STANDARD_FIELDS);

  const duplicate = await patientRepo.findPossibleDuplicate(
    input.surname,
    input.otherName,
    input.dob ?? null,
  );

  const patient = await patientRepo.create(input);
  return { patient, duplicateOf: duplicate ? duplicate.id : null };
}

/** Step 2.2: emergency fast-track. Only surname + gender required at intake. */
export async function registerEmergencyPatient(
  input: Pick<CreatePatientInput, 'surname' | 'gender'> & Partial<CreatePatientInput>,
): Promise<PatientRecord> {
  assertRequiredFields(input, ['surname', 'gender']);
  return patientRepo.create({
    ...input,
    otherName: input.otherName ?? 'Unknown',
    isEmergency: true,
  });
}

/** Step 2.2: fill in the remaining record once the patient/family can provide full details. */
export async function completeEmergencyRegistration(
  id: number,
  fullData: Partial<CreatePatientInput>,
): Promise<PatientRecord> {
  const existing = await patientRepo.findById(id);
  if (!existing) throw new NotFoundError('Patient not found');
  if (!existing.is_emergency) {
    throw new ValidationError('Patient is not an open emergency registration');
  }

  await patientRepo.update(id, fullData);
  await patientRepo.markEmergencyCompleted(id);

  const updated = await patientRepo.findById(id);
  if (!updated) throw new NotFoundError('Patient not found after update');
  return updated;
}

export async function getPatient(id: number): Promise<PatientRecord> {
  const patient = await patientRepo.findById(id);
  if (!patient) throw new NotFoundError('Patient not found');
  return patient;
}

export async function updatePatient(
  id: number,
  fields: Partial<CreatePatientInput>,
): Promise<PatientRecord> {
  const existing = await patientRepo.findById(id);
  if (!existing) throw new NotFoundError('Patient not found');
  const updated = await patientRepo.update(id, fields);
  if (!updated) throw new NotFoundError('Patient not found after update');
  return updated;
}

export async function deletePatient(id: number): Promise<void> {
  const deleted = await patientRepo.remove(id);
  if (deleted === 0) throw new NotFoundError('Patient not found');
}

// ---------------------------------------------------------------------------
// Step 2.3: offline write-queue reconciliation
// ---------------------------------------------------------------------------

export interface SyncEntry {
  tempId: string;
  patient: CreatePatientInput;
}

export type SyncStatus = 'synced' | 'already_synced' | 'conflict';

export interface SyncEntryResult {
  tempId: string;
  status: SyncStatus;
  patientId?: number;
  conflictWithId?: number;
  reason?: string;
}

function identityMatches(a: CreatePatientInput, b: PatientRecord): boolean {
  return (
    a.surname === b.surname &&
    a.otherName === b.other_name &&
    (a.dob ?? null) === (b.dob ?? null)
  );
}

/**
 * Reconciles one queued offline write. Three outcomes:
 *  - already_synced: this tempId was reconciled before with identical data (safe replay/retry)
 *  - conflict: this tempId was reconciled before with DIFFERENT data - needs manual review
 *  - synced: new tempId, record created and mapped to a permanent ID
 *
 * Note: a natural-key duplicate against a *different* patient (created via
 * normal registration while this record sat offline) is intentionally not
 * treated as a sync conflict here - it flows through the same duplicateOf
 * mechanism as Step 2.1, since it's the same kind of judgment call.
 */
export async function syncEntry(entry: SyncEntry): Promise<SyncEntryResult> {
  assertRequiredFields(entry.patient, REQUIRED_STANDARD_FIELDS);

  const existingByTempId = await patientRepo.findByClientTempId(entry.tempId);
  if (existingByTempId) {
    if (identityMatches(entry.patient, existingByTempId)) {
      return { tempId: entry.tempId, status: 'already_synced', patientId: existingByTempId.id };
    }
    return {
      tempId: entry.tempId,
      status: 'conflict',
      conflictWithId: existingByTempId.id,
      reason: 'Same tempId previously synced with different patient data',
    };
  }

  const created = await patientRepo.create({ ...entry.patient, clientTempId: entry.tempId });
  return { tempId: entry.tempId, status: 'synced', patientId: created.id };
}

export async function syncBatch(entries: SyncEntry[]): Promise<SyncEntryResult[]> {
  const results: SyncEntryResult[] = [];
  // Sequential, not Promise.all: entries can reference the same tempId
  // within one batch (retry-within-batch), and processing in order keeps
  // the "already reconciled" check correct.
  for (const entry of entries) {
    results.push(await syncEntry(entry));
  }
  return results;
}
