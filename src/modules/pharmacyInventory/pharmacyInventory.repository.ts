import { db } from '../../db/connection';

export interface PharmacyInventoryRecord {
  id: number;
  medicine_code: string;
  name: string;
  stock_qty: number;
  reorder_level: number;
  unit_cost: number;
  created_at: string;
  updated_at: string;
}

export async function findByCode(medicineCode: string): Promise<PharmacyInventoryRecord | undefined> {
  return db<PharmacyInventoryRecord>('pharmacy_inventory').where({ medicine_code: medicineCode }).first();
}

export async function create(input: {
  medicineCode: string;
  name: string;
  stockQty: number;
  reorderLevel: number;
  unitCost: number;
}): Promise<PharmacyInventoryRecord> {
  const [id] = await db('pharmacy_inventory').insert({
    medicine_code: input.medicineCode,
    name: input.name,
    stock_qty: input.stockQty,
    reorder_level: input.reorderLevel,
    unit_cost: input.unitCost,
  });
  const created = await db<PharmacyInventoryRecord>('pharmacy_inventory').where({ id }).first();
  if (!created) throw new Error('Failed to load newly created inventory item');
  return created;
}

/**
 * Atomic conditional decrement: the WHERE clause enforces stock_qty >= qty
 * in the same query, so two concurrent dispense requests can't both succeed
 * against the same low-stock item (same pattern as bed admission in Step 4.1).
 */
export async function decrementStock(medicineCode: string, quantity: number): Promise<number> {
  return db('pharmacy_inventory')
    .where('medicine_code', medicineCode)
    .andWhere('stock_qty', '>=', quantity)
    .update({ stock_qty: db.raw('stock_qty - ?', [quantity]) });
}

export async function findLowStock(): Promise<PharmacyInventoryRecord[]> {
  return db<PharmacyInventoryRecord>('pharmacy_inventory').whereRaw('stock_qty <= reorder_level');
}
