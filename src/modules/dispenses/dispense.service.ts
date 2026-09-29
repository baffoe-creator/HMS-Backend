import * as dispenseRepo from './dispense.repository';
import { DispenseRecord } from './dispense.repository';
import * as prescriptionRepo from '../prescriptions/prescription.repository';
import * as inventoryService from '../pharmacyInventory/pharmacyInventory.service';

export class ValidationError extends Error {
  statusCode = 400;
}

export interface DispenseInput {
  prescriptionId: number;
  pharmacyTechId: number;
  quantity: number;
}

/**
 * Step 5.2 gate: dispensing is blocked without a valid (existing, active)
 * prescription - checked before touching inventory at all - and stock is
 * decremented atomically via pharmacyInventory.service's conditional UPDATE.
 */
export async function dispense(input: DispenseInput): Promise<DispenseRecord> {
  if (!input.prescriptionId || !input.pharmacyTechId || !input.quantity) {
    throw new ValidationError('prescriptionId, pharmacyTechId, and quantity are required');
  }

  const prescription = await prescriptionRepo.findById(input.prescriptionId);
  if (!prescription || prescription.status !== 'active') {
    throw new ValidationError('No valid active prescription found for dispensing');
  }

  const inventoryItem = await inventoryService.getItem(prescription.medicine_code);
  await inventoryService.decrementStock(prescription.medicine_code, input.quantity);

  const record = await dispenseRepo.create({
    prescriptionId: input.prescriptionId,
    pharmacyTechId: input.pharmacyTechId,
    quantity: input.quantity,
    unitPrice: inventoryItem.unit_cost,
  });

  await prescriptionRepo.updateStatus(input.prescriptionId, 'completed');

  return record;
}
