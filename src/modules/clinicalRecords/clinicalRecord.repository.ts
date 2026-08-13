import { db } from '../../db/connection';

export interface ClinicalRecord {
  id: number;
  patient_id: number;
  clinician_id: number;
  vitals: Record<string, unknown> | null;
  history: string | null;
  diagnosis_icd_code: string | null;
  notes: string | null;
  encounter_date: string;
  created_at: string;
  updated_at: string;
}

export interface CreateClinicalRecordInput {
  patientId: number;
  clinicianId: number;
  vitals?: Record<string, unknown>;
  history?: string;
  diagnosisIcdCode?: string;
  notes?: string;
  encounterDate: string;
}

export async function create(input: CreateClinicalRecordInput): Promise<ClinicalRecord> {
  const [id] = await db('clinical_records').insert({
    patient_id: input.patientId,
    clinician_id: input.clinicianId,
    vitals: input.vitals ? JSON.stringify(input.vitals) : null,
    history: input.history ?? null,
    diagnosis_icd_code: input.diagnosisIcdCode ?? null,
    notes: input.notes ?? null,
    encounter_date: input.encounterDate,
  });
  const created = await findById(id);
  if (!created) throw new Error('Failed to load newly created clinical record');
  return created;
}

export async function findById(id: number): Promise<ClinicalRecord | undefined> {
  return db<ClinicalRecord>('clinical_records').where({ id }).first();
}

export async function findByPatient(patientId: number): Promise<ClinicalRecord[]> {
  return db<ClinicalRecord>('clinical_records')
    .where({ patient_id: patientId })
    .orderBy('encounter_date', 'desc');
}
