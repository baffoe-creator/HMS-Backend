import * as billingRepo from './billing.repository';

export class ValidationError extends Error {
  statusCode = 400;
}
export class NotFoundError extends Error {
  statusCode = 404;
}

export interface GenerateInvoiceInput {
  patientId: number;
  lineItems: { description: string; amount: number }[];
}

/** Step 5.3 gate: total_amount always equals the sum of the line items - computed here, not trusted from input. */
export async function generateInvoice(input: GenerateInvoiceInput) {
  if (!input.patientId || !Array.isArray(input.lineItems) || input.lineItems.length === 0) {
    throw new ValidationError('patientId and a non-empty lineItems array are required');
  }
  for (const item of input.lineItems) {
    if (!item.description || typeof item.amount !== 'number' || item.amount < 0) {
      throw new ValidationError('Each line item needs a description and a non-negative amount');
    }
  }

  return billingRepo.createBillWithLineItems(input);
}

export async function getInvoice(id: number) {
  const result = await billingRepo.findBillById(id);
  if (!result) throw new NotFoundError('Bill not found');
  return result;
}
