import { db } from '../../db/connection';

export interface DispenseRecord {
  id: number;
  prescription_id: number;
  pharmacy_tech_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  dispensed_at: string;
  created_at: string;
  updated_at: string;
}

export async function create(input: {
  prescriptionId: number;
  pharmacyTechId: number;
  quantity: number;
  unitPrice: number;
}): Promise<DispenseRecord> {
  const totalPrice = Number((input.quantity * input.unitPrice).toFixed(2));
  const [id] = await db('dispenses').insert({
    prescription_id: input.prescriptionId,
    pharmacy_tech_id: input.pharmacyTechId,
    quantity: input.quantity,
    unit_price: input.unitPrice,
    total_price: totalPrice,
    dispensed_at: new Date(),
  });
  const created = await db<DispenseRecord>('dispenses').where({ id }).first();
  if (!created) throw new Error('Failed to load newly created dispense record');
  return created;
}
