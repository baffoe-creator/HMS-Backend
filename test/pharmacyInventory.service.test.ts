import * as inventoryService from '../src/modules/pharmacyInventory/pharmacyInventory.service';
import * as inventoryRepo from '../src/modules/pharmacyInventory/pharmacyInventory.repository';
import { PharmacyInventoryRecord } from '../src/modules/pharmacyInventory/pharmacyInventory.repository';

jest.mock('../src/modules/pharmacyInventory/pharmacyInventory.repository');
const mockedRepo = inventoryRepo as jest.Mocked<typeof inventoryRepo>;

function fakeItem(overrides: Partial<PharmacyInventoryRecord> = {}): PharmacyInventoryRecord {
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

describe('PharmacyInventoryService - Step 5.1 gate', () => {
  afterEach(() => jest.resetAllMocks());

  it('decrements stock on a successful dispense', async () => {
    mockedRepo.findByCode
      .mockResolvedValueOnce(fakeItem({ stock_qty: 100 }))
      .mockResolvedValueOnce(fakeItem({ stock_qty: 90 }));
    mockedRepo.decrementStock.mockResolvedValue(1);

    const result = await inventoryService.decrementStock('PARACETAMOL', 10);
    expect(result.stock_qty).toBe(90);
    expect(mockedRepo.decrementStock).toHaveBeenCalledWith('PARACETAMOL', 10);
  });

  it('rejects a decrement that would exceed available stock', async () => {
    mockedRepo.findByCode.mockResolvedValue(fakeItem({ stock_qty: 5 }));
    mockedRepo.decrementStock.mockResolvedValue(0); // conditional UPDATE matched nothing

    await expect(inventoryService.decrementStock('PARACETAMOL', 10)).rejects.toBeInstanceOf(
      inventoryService.ConflictError,
    );
  });

  it('throws NotFoundError for an unknown medicine code', async () => {
    mockedRepo.findByCode.mockResolvedValue(undefined);
    await expect(inventoryService.decrementStock('UNKNOWN', 1)).rejects.toBeInstanceOf(
      inventoryService.NotFoundError,
    );
  });

  it('returns items at or below their reorder level as alerts', async () => {
    mockedRepo.findLowStock.mockResolvedValue([fakeItem({ stock_qty: 5, reorder_level: 20 })]);
    const alerts = await inventoryService.getLowStockAlerts();
    expect(alerts).toHaveLength(1);
  });
});
