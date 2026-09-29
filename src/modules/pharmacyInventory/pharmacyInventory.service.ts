import * as inventoryRepo from './pharmacyInventory.repository';
import { PharmacyInventoryRecord } from './pharmacyInventory.repository';

export class ValidationError extends Error {
  statusCode = 400;
}
export class NotFoundError extends Error {
  statusCode = 404;
}
export class ConflictError extends Error {
  statusCode = 409;
}

export async function createItem(input: {
  medicineCode: string;
  name: string;
  stockQty: number;
  reorderLevel: number;
  unitCost: number;
}): Promise<PharmacyInventoryRecord> {
  if (!input.medicineCode || !input.name || input.stockQty === undefined || input.unitCost === undefined) {
    throw new ValidationError('medicineCode, name, stockQty, and unitCost are required');
  }
  return inventoryRepo.create(input);
}

export async function getItem(medicineCode: string): Promise<PharmacyInventoryRecord> {
  const item = await inventoryRepo.findByCode(medicineCode);
  if (!item) throw new NotFoundError('Inventory item not found');
  return item;
}

/** Step 5.1 gate: stock decrement on dispense. Throws if insufficient stock. */
export async function decrementStock(medicineCode: string, quantity: number): Promise<PharmacyInventoryRecord> {
  const item = await inventoryRepo.findByCode(medicineCode);
  if (!item) throw new NotFoundError('Inventory item not found');

  const rowsAffected = await inventoryRepo.decrementStock(medicineCode, quantity);
  if (rowsAffected === 0) {
    throw new ConflictError(`Insufficient stock for ${medicineCode} (have ${item.stock_qty}, need ${quantity})`);
  }

  const updated = await inventoryRepo.findByCode(medicineCode);
  if (!updated) throw new NotFoundError('Inventory item not found after update');
  return updated;
}

/** Step 5.1 gate: reorder-level alert - items at or below their reorder threshold. */
export async function getLowStockAlerts(): Promise<PharmacyInventoryRecord[]> {
  return inventoryRepo.findLowStock();
}
