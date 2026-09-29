import { db } from '../../db/connection';

export interface BillRecord {
  id: number;
  patient_id: number;
  claim_id: number | null;
  total_amount: number;
  paid_status: 'unpaid' | 'partial' | 'paid';
  created_at: string;
  updated_at: string;
}

export interface BillLineItemRecord {
  id: number;
  bill_id: number;
  description: string;
  amount: number;
}

export async function createBillWithLineItems(input: {
  patientId: number;
  lineItems: { description: string; amount: number }[];
}): Promise<{ bill: BillRecord; lineItems: BillLineItemRecord[] }> {
  const totalAmount = input.lineItems.reduce((sum, item) => sum + item.amount, 0);

  const [billId] = await db('bills').insert({
    patient_id: input.patientId,
    total_amount: Number(totalAmount.toFixed(2)),
    paid_status: 'unpaid',
  });

  const lineItemRows = input.lineItems.map((item) => ({
    bill_id: billId,
    description: item.description,
    amount: item.amount,
  }));
  await db('bill_line_items').insert(lineItemRows);

  const bill = await db<BillRecord>('bills').where({ id: billId }).first();
  const lineItems = await db<BillLineItemRecord>('bill_line_items').where({ bill_id: billId });
  if (!bill) throw new Error('Failed to load newly created bill');

  return { bill, lineItems };
}

export async function findBillById(
  id: number,
): Promise<{ bill: BillRecord; lineItems: BillLineItemRecord[] } | undefined> {
  const bill = await db<BillRecord>('bills').where({ id }).first();
  if (!bill) return undefined;
  const lineItems = await db<BillLineItemRecord>('bill_line_items').where({ bill_id: id });
  return { bill, lineItems };
}
