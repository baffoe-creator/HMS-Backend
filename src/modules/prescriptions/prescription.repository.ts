import { db } from '../../db/connection';

export interface PrescriptionRecord {
  id: number;
  patient_id: number;
  clinician_id: number;
  medicine_code: string;
  dosage: string;
  instructions: string | null;
  status: 'active' | 'completed' | 'cancelled';
  prescribed_date: string;
  created_at: string;
  updated_at: string;
}

export async function create(input: {
  patientId: number;
  clinicianId: number;
  medicineCode: string;
  dosage: string;
  instructions?: string;
  prescribedDate: string;
}): Promise<PrescriptionRecord> {
  const [id] = await db('prescriptions').insert({
    patient_id: input.patientId,
    clinician_id: input.clinicianId,
    medicine_code: input.medicineCode,
    dosage: input.dosage,
    instructions: input.instructions ?? null,
    prescribed_date: input.prescribedDate,
    status: 'active',
  });
  const created = await db<PrescriptionRecord>('prescriptions').where({ id }).first();
  if (!created) throw new Error('Failed to load newly created prescription');
  return created;
}

export async function findById(id: number): Promise<PrescriptionRecord | undefined> {
  return db<PrescriptionRecord>('prescriptions').where({ id }).first();
}

export async function updateStatus(
  id: number,
  status: PrescriptionRecord['status'],
): Promise<void> {
  await db('prescriptions').where({ id }).update({ status });
}

export async function findActiveByPatient(patientId: number): Promise<PrescriptionRecord[]> {
  return db<PrescriptionRecord>('prescriptions').where({ patient_id: patientId, status: 'active' });
}

export async function findAllergiesByPatient(
  patientId: number,
): Promise<{ id: number; allergen: string }[]> {
  return db('patient_allergies').select('id', 'allergen').where({ patient_id: patientId });
}

export async function findInteraction(
  medicineCodeA: string,
  medicineCodeB: string,
): Promise<{ severity: string; description: string } | undefined> {
  return db('drug_interactions')
    .select('severity', 'description')
    .where({ medicine_code_a: medicineCodeA, medicine_code_b: medicineCodeB })
    .orWhere({ medicine_code_a: medicineCodeB, medicine_code_b: medicineCodeA })
    .first();
}
