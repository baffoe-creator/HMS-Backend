import * as appointmentRepo from './appointment.repository';
import { AppointmentRecord } from './appointment.repository';
import { mysqlDatetimeToIsoUtc } from '../../utils/datetime';

export class ValidationError extends Error {
  statusCode = 400;
}
export class ConflictError extends Error {
  statusCode = 409;
}

const SLOT_MINUTES = 30;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 17;

export interface BookAppointmentInput {
  patientId: number;
  doctorId: number;
  appointmentTime: string; // ISO datetime, expected to land on a 30-minute slot boundary
}

/** Step 2.4: books an appointment, rejecting an exact doctor+slot collision. */
export async function bookAppointment(input: BookAppointmentInput): Promise<AppointmentRecord> {
  if (!input.patientId || !input.doctorId || !input.appointmentTime) {
    throw new ValidationError('patientId, doctorId, and appointmentTime are required');
  }

  const existing = await appointmentRepo.findByDoctorAndTime(input.doctorId, input.appointmentTime);
  if (existing) {
    throw new ConflictError('This doctor already has a scheduled appointment at that time');
  }

  return appointmentRepo.create(input);
}

function buildDaySlots(dateIso: string): string[] {
  const slots: string[] = [];
  const [year, month, day] = dateIso.split('-').map(Number);
  for (let hour = DAY_START_HOUR; hour < DAY_END_HOUR; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_MINUTES) {
      const slot = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
      slots.push(slot.toISOString());
    }
  }
  return slots;
}

/** Step 2.4: real-time availability - all day slots minus already-booked ones. */
export async function getAvailability(doctorId: number, dateIso: string): Promise<string[]> {
  if (!doctorId || !dateIso) {
    throw new ValidationError('doctorId and date are required');
  }

  const rangeStart = `${dateIso}T00:00:00.000Z`;
  const rangeEnd = `${dateIso}T23:59:59.999Z`;
  const booked = await appointmentRepo.findScheduledForDoctorInRange(doctorId, rangeStart, rangeEnd);
  const bookedTimes = new Set(booked.map((a) => mysqlDatetimeToIsoUtc(a.appointment_time)));

  return buildDaySlots(dateIso).filter((slot) => !bookedTimes.has(slot));
}
