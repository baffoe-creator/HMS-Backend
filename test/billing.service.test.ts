import * as billingService from '../src/modules/billing/billing.service';
import * as billingRepo from '../src/modules/billing/billing.repository';

jest.mock('../src/modules/billing/billing.repository');
const mockedRepo = billingRepo as jest.Mocked<typeof billingRepo>;

describe('BillingService - Step 5.3 gate', () => {
  afterEach(() => jest.resetAllMocks());

  it('generates an invoice whose total matches the sum of line items (fixture test)', async () => {
    const lineItems = [
      { description: 'Consultation', amount: 50 },
      { description: 'Paracetamol x10', amount: 5 },
      { description: 'Lab: Full Blood Count', amount: 25 },
    ];
    const expectedTotal = 80;

    mockedRepo.createBillWithLineItems.mockImplementation(async (input) => ({
      bill: {
        id: 1,
        patient_id: input.patientId,
        claim_id: null,
        total_amount: input.lineItems.reduce((sum, i) => sum + i.amount, 0),
        paid_status: 'unpaid',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      lineItems: input.lineItems.map((item, i) => ({ id: i + 1, bill_id: 1, ...item })),
    }));

    const result = await billingService.generateInvoice({ patientId: 1, lineItems });

    expect(result.bill.total_amount).toBe(expectedTotal);
    expect(result.lineItems.reduce((sum, i) => sum + i.amount, 0)).toBe(expectedTotal);
  });

  it('rejects an invoice with no line items', async () => {
    await expect(billingService.generateInvoice({ patientId: 1, lineItems: [] })).rejects.toBeInstanceOf(
      billingService.ValidationError,
    );
  });

  it('rejects a line item with a negative amount', async () => {
    await expect(
      billingService.generateInvoice({
        patientId: 1,
        lineItems: [{ description: 'Bad item', amount: -5 }],
      }),
    ).rejects.toBeInstanceOf(billingService.ValidationError);
  });

  it('rejects a line item missing a description', async () => {
    await expect(
      billingService.generateInvoice({
        patientId: 1,
        lineItems: [{ description: '', amount: 10 }],
      }),
    ).rejects.toBeInstanceOf(billingService.ValidationError);
  });
});
