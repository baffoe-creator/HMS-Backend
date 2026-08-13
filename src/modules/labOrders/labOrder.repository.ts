import { db } from '../../db/connection';

export type LabOrderStatus = 'ordered' | 'in_progress' | 'completed' | 'cancelled';

export interface LabOrderRecord {
  id: number;
  patient_id: number;
  test_type: string;
  ordered_by: number;
  result: string | null;
  status: LabOrderStatus;
  ordered_date: string;
  created_at: string;
  updated_at: string;
}

export async function create(input: {
  patientId: number;
  testType: string;
  orderedBy: number;
  orderedDate: string;
}): Promise<LabOrderRecord> {
  const [id] = await db('lab_orders').insert({
    patient_id: input.patientId,
    test_type: input.testType,
    ordered_by: input.orderedBy,
    ordered_date: input.orderedDate,
    status: 'ordered',
  });
  const created = await findById(id);
  if (!created) throw new Error('Failed to load newly created lab order');
  return created;
}

export async function findById(id: number): Promise<LabOrderRecord | undefined> {
  return db<LabOrderRecord>('lab_orders').where({ id }).first();
}

export async function updateStatus(
  id: number,
  status: LabOrderStatus,
  result?: string,
): Promise<LabOrderRecord | undefined> {
  const row: Record<string, unknown> = { status };
  if (result !== undefined) row.result = result;
  await db('lab_orders').where({ id }).update(row);
  return findById(id);
}
