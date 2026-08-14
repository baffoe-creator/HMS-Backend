import * as otBookingService from '../src/modules/otBookings/otBooking.service';
import * as otBookingRepo from '../src/modules/otBookings/otBooking.repository';
import * as roomBedRepo from '../src/modules/roomsBeds/roomBed.repository';
import { OtBookingRecord } from '../src/modules/otBookings/otBooking.repository';
import { RoomBedRecord } from '../src/modules/roomsBeds/roomBed.repository';

jest.mock('../src/modules/otBookings/otBooking.repository');
jest.mock('../src/modules/roomsBeds/roomBed.repository');
const mockedBookingRepo = otBookingRepo as jest.Mocked<typeof otBookingRepo>;
const mockedRoomRepo = roomBedRepo as jest.Mocked<typeof roomBedRepo>;

function fakeOtRoom(overrides: Partial<RoomBedRecord> = {}): RoomBedRecord {
  return {
    id: 1,
    room_number: 'OT-1',
    bed_number: '-',
    status: 'available',
    room_type: 'ot',
    current_patient_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function fakeBooking(overrides: Partial<OtBookingRecord> = {}): OtBookingRecord {
  return {
    id: 1,
    room_id: 1,
    patient_id: 1,
    surgeon_id: 10,
    scheduled_start: '2026-09-01T09:00:00.000Z',
    scheduled_end: '2026-09-01T11:00:00.000Z',
    status: 'scheduled',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const BASE_INPUT = {
  roomId: 1,
  patientId: 1,
  surgeonId: 10,
  scheduledStart: '2026-09-01T09:00:00.000Z',
  scheduledEnd: '2026-09-01T11:00:00.000Z',
};

describe('OtBookingService - Step 4.2 gate', () => {
  afterEach(() => jest.resetAllMocks());

  it('books successfully when there is no overlapping booking', async () => {
    mockedRoomRepo.findById.mockResolvedValue(fakeOtRoom());
    mockedBookingRepo.findOverlapping.mockResolvedValue(undefined);
    mockedBookingRepo.create.mockResolvedValue(fakeBooking());

    const result = await otBookingService.bookOt(BASE_INPUT);
    expect(result.id).toBe(1);
  });

  it('rejects an overlapping booking in the same theatre', async () => {
    mockedRoomRepo.findById.mockResolvedValue(fakeOtRoom());
    mockedBookingRepo.findOverlapping.mockResolvedValue(fakeBooking());

    await expect(otBookingService.bookOt(BASE_INPUT)).rejects.toBeInstanceOf(
      otBookingService.ConflictError,
    );
    expect(mockedBookingRepo.create).not.toHaveBeenCalled();
  });

  it('rejects booking a room that is not an operating theatre', async () => {
    mockedRoomRepo.findById.mockResolvedValue(fakeOtRoom({ room_type: 'ward' }));

    await expect(otBookingService.bookOt(BASE_INPUT)).rejects.toBeInstanceOf(
      otBookingService.ValidationError,
    );
  });

  it('rejects a booking where end is before or equal to start', async () => {
    mockedRoomRepo.findById.mockResolvedValue(fakeOtRoom());
    await expect(
      otBookingService.bookOt({ ...BASE_INPUT, scheduledEnd: BASE_INPUT.scheduledStart }),
    ).rejects.toBeInstanceOf(otBookingService.ValidationError);
  });

  it('rejects booking a nonexistent room', async () => {
    mockedRoomRepo.findById.mockResolvedValue(undefined);
    await expect(otBookingService.bookOt(BASE_INPUT)).rejects.toBeInstanceOf(
      otBookingService.NotFoundError,
    );
  });

  it('rejects a booking missing required fields', async () => {
    await expect(
      otBookingService.bookOt({ roomId: 1 } as unknown as Parameters<typeof otBookingService.bookOt>[0]),
    ).rejects.toBeInstanceOf(otBookingService.ValidationError);
  });
});
