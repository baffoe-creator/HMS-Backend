import * as labOrderService from '../src/modules/labOrders/labOrder.service';
import * as labOrderRepo from '../src/modules/labOrders/labOrder.repository';
import { LabOrderRecord } from '../src/modules/labOrders/labOrder.repository';

jest.mock('../src/modules/labOrders/labOrder.repository');
const mockedRepo = labOrderRepo as jest.Mocked<typeof labOrderRepo>;

function fakeOrder(overrides: Partial<LabOrderRecord> = {}): LabOrderRecord {
  return {
    id: 1,
    patient_id: 1,
    test_type: 'Full Blood Count',
    ordered_by: 10,
    result: null,
    status: 'ordered',
    ordered_date: '2026-08-13',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('LabOrderService - Step 3.3 gate', () => {
  afterEach(() => jest.resetAllMocks());

  it('walks the full ordered -> in_progress -> completed sequence', async () => {
    mockedRepo.findById.mockResolvedValueOnce(fakeOrder({ status: 'ordered' }));
    mockedRepo.updateStatus.mockResolvedValueOnce(fakeOrder({ status: 'in_progress' }));
    const step1 = await labOrderService.transitionStatus(1, 'in_progress');
    expect(step1.status).toBe('in_progress');

    mockedRepo.findById.mockResolvedValueOnce(fakeOrder({ status: 'in_progress' }));
    mockedRepo.updateStatus.mockResolvedValueOnce(fakeOrder({ status: 'completed', result: 'Normal' }));
    const step2 = await labOrderService.transitionStatus(1, 'completed', 'Normal');
    expect(step2.status).toBe('completed');
  });

  it('rejects skipping straight from ordered to completed', async () => {
    mockedRepo.findById.mockResolvedValue(fakeOrder({ status: 'ordered' }));
    await expect(labOrderService.transitionStatus(1, 'completed', 'x')).rejects.toBeInstanceOf(
      labOrderService.ValidationError,
    );
    expect(mockedRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('rejects any transition out of a terminal state', async () => {
    mockedRepo.findById.mockResolvedValue(fakeOrder({ status: 'completed' }));
    await expect(labOrderService.transitionStatus(1, 'in_progress')).rejects.toBeInstanceOf(
      labOrderService.ValidationError,
    );
  });

  it('requires a result when completing an order', async () => {
    mockedRepo.findById.mockResolvedValue(fakeOrder({ status: 'in_progress' }));
    await expect(labOrderService.transitionStatus(1, 'completed')).rejects.toBeInstanceOf(
      labOrderService.ValidationError,
    );
  });

  it('allows cancelling from either ordered or in_progress', async () => {
    mockedRepo.findById.mockResolvedValueOnce(fakeOrder({ status: 'ordered' }));
    mockedRepo.updateStatus.mockResolvedValueOnce(fakeOrder({ status: 'cancelled' }));
    const result = await labOrderService.transitionStatus(1, 'cancelled');
    expect(result.status).toBe('cancelled');
  });

  it('throws NotFoundError for a nonexistent order', async () => {
    mockedRepo.findById.mockResolvedValue(undefined);
    await expect(labOrderService.transitionStatus(999, 'in_progress')).rejects.toBeInstanceOf(
      labOrderService.NotFoundError,
    );
  });
});
