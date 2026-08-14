import * as roomBedService from '../src/modules/roomsBeds/roomBed.service';
import * as roomBedRepo from '../src/modules/roomsBeds/roomBed.repository';
import { RoomBedRecord } from '../src/modules/roomsBeds/roomBed.repository';

jest.mock('../src/modules/roomsBeds/roomBed.repository');
const mockedRepo = roomBedRepo as jest.Mocked<typeof roomBedRepo>;

function fakeBed(overrides: Partial<RoomBedRecord> = {}): RoomBedRecord {
  return {
    id: 1,
    room_number: '101',
    bed_number: 'A',
    status: 'available',
    room_type: 'ward',
    current_patient_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('RoomBedService - Step 4.1 gate', () => {
  afterEach(() => jest.resetAllMocks());

  it('admits a patient into an available bed', async () => {
    mockedRepo.findById
      .mockResolvedValueOnce(fakeBed({ status: 'available' }))
      .mockResolvedValueOnce(fakeBed({ status: 'occupied', current_patient_id: 5 }));
    mockedRepo.admit.mockResolvedValue(1); // 1 row affected

    const result = await roomBedService.admitPatient(1, 5);
    expect(result.status).toBe('occupied');
    expect(result.current_patient_id).toBe(5);
  });

  it('prevents double-assignment when the bed is already occupied', async () => {
    mockedRepo.findById.mockResolvedValue(fakeBed({ status: 'occupied', current_patient_id: 9 }));
    mockedRepo.admit.mockResolvedValue(0); // the conditional UPDATE matched nothing

    await expect(roomBedService.admitPatient(1, 5)).rejects.toBeInstanceOf(
      roomBedService.ConflictError,
    );
  });

  it('discharges a patient from an occupied bed', async () => {
    mockedRepo.findById
      .mockResolvedValueOnce(fakeBed({ status: 'occupied', current_patient_id: 5 }))
      .mockResolvedValueOnce(fakeBed({ status: 'available', current_patient_id: null }));
    mockedRepo.discharge.mockResolvedValue(1);

    const result = await roomBedService.dischargePatient(1);
    expect(result.status).toBe('available');
    expect(result.current_patient_id).toBeNull();
  });

  it('rejects discharging a bed that is not currently occupied', async () => {
    mockedRepo.findById.mockResolvedValue(fakeBed({ status: 'available' }));
    mockedRepo.discharge.mockResolvedValue(0);

    await expect(roomBedService.dischargePatient(1)).rejects.toBeInstanceOf(
      roomBedService.ConflictError,
    );
  });

  it('throws NotFoundError for a nonexistent bed', async () => {
    mockedRepo.findById.mockResolvedValue(undefined);
    await expect(roomBedService.admitPatient(999, 5)).rejects.toBeInstanceOf(
      roomBedService.NotFoundError,
    );
  });
});
