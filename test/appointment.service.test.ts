import * as appointmentService from '../src/modules/appointments/appointment.service';
import * as appointmentRepo from '../src/modules/appointments/appointment.repository';
import { AppointmentRecord } from '../src/modules/appointments/appointment.repository';

jest.mock('../src/modules/appointments/appointment.repository');
const mockedRepo = appointmentRepo as jest.Mocked<typeof appointmentRepo>;

function fakeAppointment(overrides: Partial<AppointmentRecord> = {}): AppointmentRecord {
  return {
    id: 1,
    patient_id: 1,
    doctor_id: 10,
    appointment_time: '2026-08-12T09:00:00.000Z',
    status: 'scheduled',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('AppointmentService - Step 2.4 gate', () => {
  afterEach(() => jest.resetAllMocks());

  describe('bookAppointment', () => {
    it('books successfully when the doctor has no conflicting appointment', async () => {
      mockedRepo.findByDoctorAndTime.mockResolvedValue(undefined);
      mockedRepo.create.mockResolvedValue(fakeAppointment({ id: 7 }));

      const result = await appointmentService.bookAppointment({
        patientId: 1,
        doctorId: 10,
        appointmentTime: '2026-08-12T09:00:00.000Z',
      });

      expect(result.id).toBe(7);
    });

    it('rejects a double-booking for the same doctor + exact time slot', async () => {
      mockedRepo.findByDoctorAndTime.mockResolvedValue(fakeAppointment());

      await expect(
        appointmentService.bookAppointment({
          patientId: 2,
          doctorId: 10,
          appointmentTime: '2026-08-12T09:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(appointmentService.ConflictError);

      expect(mockedRepo.create).not.toHaveBeenCalled();
    });

    it('rejects a booking missing required fields', async () => {
      await expect(
        appointmentService.bookAppointment({ patientId: 1 } as unknown as Parameters<
          typeof appointmentService.bookAppointment
        >[0]),
      ).rejects.toBeInstanceOf(appointmentService.ValidationError);
    });
  });

  describe('getAvailability', () => {
    it('returns a full day of slots when nothing is booked', async () => {
      mockedRepo.findScheduledForDoctorInRange.mockResolvedValue([]);

      const slots = await appointmentService.getAvailability(10, '2026-08-12');

      // 08:00-17:00 in 30-min increments = 18 slots
      expect(slots).toHaveLength(18);
      expect(slots[0]).toBe('2026-08-12T08:00:00.000Z');
      expect(slots[slots.length - 1]).toBe('2026-08-12T16:30:00.000Z');
    });

    it('excludes already-booked slots from availability', async () => {
      mockedRepo.findScheduledForDoctorInRange.mockResolvedValue([
        fakeAppointment({ appointment_time: '2026-08-12T09:00:00.000Z' }),
        fakeAppointment({ appointment_time: '2026-08-12T14:30:00.000Z' }),
      ]);

      const slots = await appointmentService.getAvailability(10, '2026-08-12');

      expect(slots).toHaveLength(16);
      expect(slots).not.toContain('2026-08-12T09:00:00.000Z');
      expect(slots).not.toContain('2026-08-12T14:30:00.000Z');
    });
  });
});
