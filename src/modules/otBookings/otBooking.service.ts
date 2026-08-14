import * as otBookingRepo from './otBooking.repository';
import * as roomBedRepo from '../roomsBeds/roomBed.repository';
import { OtBookingRecord } from './otBooking.repository';

export class ValidationError extends Error {
  statusCode = 400;
}
export class NotFoundError extends Error {
  statusCode = 404;
}
export class ConflictError extends Error {
  statusCode = 409;
}

export interface BookOtInput {
  roomId: number;
  patientId: number;
  surgeonId: number;
  scheduledStart: string;
  scheduledEnd: string;
}

export async function bookOt(input: BookOtInput): Promise<OtBookingRecord> {
  if (!input.roomId || !input.patientId || !input.surgeonId || !input.scheduledStart || !input.scheduledEnd) {
    throw new ValidationError('roomId, patientId, surgeonId, scheduledStart, and scheduledEnd are required');
  }
  if (new Date(input.scheduledEnd).getTime() <= new Date(input.scheduledStart).getTime()) {
    throw new ValidationError('scheduledEnd must be after scheduledStart');
  }

  const room = await roomBedRepo.findById(input.roomId);
  if (!room) throw new NotFoundError('Room not found');
  if (room.room_type !== 'ot') {
    throw new ValidationError('roomId does not refer to an operating theatre');
  }

  const conflict = await otBookingRepo.findOverlapping(input.roomId, input.scheduledStart, input.scheduledEnd);
  if (conflict) {
    throw new ConflictError('This operating theatre is already booked for an overlapping time window');
  }

  return otBookingRepo.create(input);
}
