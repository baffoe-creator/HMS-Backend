import * as dispenseService from '../src/modules/dispenses/dispense.service';
import * as dispenseRepo from '../src/modules/dispenses/dispense.repository';
import * as prescriptionRepo from '../src/modules/prescriptions/prescription.repository';
import * as inventoryService from '../src/modules/pharmacyInventory/pharmacyInventory.service';
import { PrescriptionRecord } from '../src/modules/prescriptions/prescription.repository';
import { PharmacyInventoryRecord } from '../src/modules/pharmacyInventory/pharmacyInventory.repository';

jest.mock('../src/modules/dispenses/dispense.repository');
jest.mock('../src/modules/prescriptions/prescription.repository');
jest.mock('../src/modules/pharmacyInventory/pharmacyInventory.service');

const mockedDispenseRepo = dispenseRepo as jest.Mocked<typeof dispenseRepo>;
const mockedPrescriptionRepo = prescriptionRepo as jest.Mocked<typeof prescriptionRepo>;
const mockedInventoryService = inventoryService as jest.Mocked<typeof inventoryService>;

function fakePrescription(overrides: Partial<PrescriptionRecord> = {}): PrescriptionRecord {
  return {
    id: 1,
    patient_id: 1,
    clinician_id: 10,
    medicine_code: 'PARACETAMOL',
    dosage: '500mg twice daily',
    instructions: null,
    status: 'active',
    prescribed_date: '2026-08-14',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function fakeInventoryItem(overrides: Partial<PharmacyInventoryRecord> = {}): PharmacyInventoryRecord {
  return {
    id: 1,
    medicine_code: 'PARACETAMOL',
    name: 'Paracetamol 500mg',
    stock_qty: 100,
    reorder_level: 20,
    unit_cost: 0.5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const BASE_INPUT = { prescriptionId: 1, pharmacyTechId: 20, quantity: 10 };

describe('DispenseService - Step 5.2 gate', () => {
  afterEach(() => jest.resetAllMocks());

  it('dispenses successfully against a valid active prescription', async () => {
    mockedPrescriptionRepo.findById.mockResolvedValue(fakePrescription());
    mockedInventoryService.getItem.mockResolvedValue(fakeInventoryItem());
    mockedInventoryService.decrementStock.mockResolvedValue(fakeInventoryItem({ stock_qty: 90 }));
    mockedDispenseRepo.create.mockResolvedValue({
      id: 1,
      prescription_id: 1,
      pharmacy_tech_id: 20,
      quantity: 10,
      unit_price: 0.5,
      total_price: 5,
      dispensed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const result = await dispenseService.dispense(BASE_INPUT);

    expect(mockedInventoryService.decrementStock).toHaveBeenCalledWith('PARACETAMOL', 10);
    expect(mockedPrescriptionRepo.updateStatus).toHaveBeenCalledWith(1, 'completed');
    expect(result.total_price).toBe(5);
  });

  it('blocks dispensing when the prescription does not exist', async () => {
    mockedPrescriptionRepo.findById.mockResolvedValue(undefined);

    await expect(dispenseService.dispense(BASE_INPUT)).rejects.toBeInstanceOf(
      dispenseService.ValidationError,
    );
    expect(mockedInventoryService.decrementStock).not.toHaveBeenCalled();
  });

  it('blocks dispensing against a prescription that is not active (e.g. already completed)', async () => {
    mockedPrescriptionRepo.findById.mockResolvedValue(fakePrescription({ status: 'completed' }));

    await expect(dispenseService.dispense(BASE_INPUT)).rejects.toBeInstanceOf(
      dispenseService.ValidationError,
    );
    expect(mockedInventoryService.decrementStock).not.toHaveBeenCalled();
  });

  it('rejects a dispense request missing required fields', async () => {
    await expect(
      dispenseService.dispense({ prescriptionId: 1 } as unknown as Parameters<
        typeof dispenseService.dispense
      >[0]),
    ).rejects.toBeInstanceOf(dispenseService.ValidationError);
  });
});
