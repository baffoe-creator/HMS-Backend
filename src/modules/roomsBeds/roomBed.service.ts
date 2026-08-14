import * as roomBedRepo from './roomBed.repository';
import { RoomBedRecord } from './roomBed.repository';

export class ValidationError extends Error {
  statusCode = 400;
}
export class NotFoundError extends Error {
  statusCode = 404;
}
export class ConflictError extends Error {
  statusCode = 409;
}

export async function getRoomBed(id: number): Promise<RoomBedRecord> {
  const record = await roomBedRepo.findById(id);
  if (!record) throw new NotFoundError('Room/bed not found');
  return record;
}

/**
 * Step 4.1 gate: prevents double-assignment. The repository's UPDATE is
 * conditioned on status='available' in the same query, so this check is
 * safe even under concurrent requests - the row count tells us definitively
 * whether the admission actually happened.
 */
export async function admitPatient(bedId: number, patientId: number): Promise<RoomBedRecord> {
  if (!patientId) throw new ValidationError('patientId is required');

  const bed = await roomBedRepo.findById(bedId);
  if (!bed) throw new NotFoundError('Room/bed not found');

  const rowsAffected = await roomBedRepo.admit(bedId, patientId);
  if (rowsAffected === 0) {
    throw new ConflictError(`Bed is not available (current status: "${bed.status}")`);
  }

  const updated = await roomBedRepo.findById(bedId);
  if (!updated) throw new NotFoundError('Room/bed not found after update');
  return updated;
}

export async function dischargePatient(bedId: number): Promise<RoomBedRecord> {
  const bed = await roomBedRepo.findById(bedId);
  if (!bed) throw new NotFoundError('Room/bed not found');

  const rowsAffected = await roomBedRepo.discharge(bedId);
  if (rowsAffected === 0) {
    throw new ConflictError(`Bed is not currently occupied (current status: "${bed.status}")`);
  }

  const updated = await roomBedRepo.findById(bedId);
  if (!updated) throw new NotFoundError('Room/bed not found after update');
  return updated;
}
