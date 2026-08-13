import * as labOrderRepo from './labOrder.repository';
import { LabOrderRecord, LabOrderStatus } from './labOrder.repository';

export class ValidationError extends Error {
  statusCode = 400;
}
export class NotFoundError extends Error {
  statusCode = 404;
}

/** Step 3.3 gate: only these transitions are legal. Both terminal states are dead ends. */
const ALLOWED_TRANSITIONS: Record<LabOrderStatus, LabOrderStatus[]> = {
  ordered: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export async function createOrder(input: {
  patientId: number;
  testType: string;
  orderedBy: number;
  orderedDate: string;
}): Promise<LabOrderRecord> {
  if (!input.patientId || !input.testType || !input.orderedBy || !input.orderedDate) {
    throw new ValidationError('patientId, testType, orderedBy, and orderedDate are required');
  }
  return labOrderRepo.create(input);
}

export async function transitionStatus(
  id: number,
  nextStatus: LabOrderStatus,
  result?: string,
): Promise<LabOrderRecord> {
  const order = await labOrderRepo.findById(id);
  if (!order) throw new NotFoundError('Lab order not found');

  const allowed = ALLOWED_TRANSITIONS[order.status];
  if (!allowed.includes(nextStatus)) {
    throw new ValidationError(`Cannot transition lab order from "${order.status}" to "${nextStatus}"`);
  }
  if (nextStatus === 'completed' && !result) {
    throw new ValidationError('result is required when completing a lab order');
  }

  const updated = await labOrderRepo.updateStatus(id, nextStatus, result);
  if (!updated) throw new NotFoundError('Lab order not found after update');
  return updated;
}

export async function getOrder(id: number): Promise<LabOrderRecord> {
  const order = await labOrderRepo.findById(id);
  if (!order) throw new NotFoundError('Lab order not found');
  return order;
}
