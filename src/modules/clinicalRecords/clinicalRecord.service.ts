import * as clinicalRecordRepo from './clinicalRecord.repository';
import { ClinicalRecord, CreateClinicalRecordInput } from './clinicalRecord.repository';
import { logAudit } from '../audit/audit.service';

export class ValidationError extends Error {
  statusCode = 400;
}
export class NotFoundError extends Error {
  statusCode = 404;
}

export async function createRecord(
  input: CreateClinicalRecordInput,
  actorUserId: number | null,
): Promise<ClinicalRecord> {
  if (!input.patientId || !input.clinicianId || !input.encounterDate) {
    throw new ValidationError('patientId, clinicianId, and encounterDate are required');
  }

  const record = await clinicalRecordRepo.create(input);

  // Step 3.2 gate: EMR mutations must produce an audit trail, same as Step 1.4.
  await logAudit({
    userId: actorUserId,
    action: 'CREATE',
    tableName: 'clinical_records',
    recordId: String(record.id),
    afterState: { patient_id: record.patient_id, diagnosis_icd_code: record.diagnosis_icd_code },
  });

  return record;
}

export async function getRecord(id: number): Promise<ClinicalRecord> {
  const record = await clinicalRecordRepo.findById(id);
  if (!record) throw new NotFoundError('Clinical record not found');
  return record;
}

export async function getPatientHistory(patientId: number): Promise<ClinicalRecord[]> {
  return clinicalRecordRepo.findByPatient(patientId);
}
