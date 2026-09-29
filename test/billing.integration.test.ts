import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/db/connection';
import * as authService from '../src/modules/auth/auth.service';

const app = createApp();

describe('Billing / invoice generation (integration, requires DB) - Step 5.3 gate', () => {
  let accountantToken: string;
  let patientId: number;
  let billId: number;

  beforeAll(async () => {
    await db('users').where({ username: 'phase5_accountant' }).del();

    const hash = await authService.hashPassword('Pass123!');
    const [id] = await db('users').insert({
      username: 'phase5_accountant',
      password_hash: hash,
      role: 'accountant',
      is_active: true,
    });
    accountantToken = authService.issueTokenPair({
      id,
      username: 'phase5_accountant',
      role: 'accountant',
    }).accessToken;

    const [pid] = await db('patients').insert({ surname: 'Billing', other_name: 'Case', gender: 'female' });
    patientId = pid;
  });

  afterAll(async () => {
    if (billId) {
      await db('bill_line_items').where({ bill_id: billId }).del();
      await db('bills').where({ id: billId }).del();
    }
    await db('patients').where({ id: patientId }).del();
    await db('users').where({ username: 'phase5_accountant' }).del();
    await db.destroy();
  });

  it('generates an invoice whose total matches the sum of the line items', async () => {
    const res = await request(app)
      .post('/bills')
      .set('Authorization', `Bearer ${accountantToken}`)
      .send({
        patientId,
        lineItems: [
          { description: 'Consultation', amount: 50 },
          { description: 'Amoxicillin x20', amount: 4 },
          { description: 'Lab: Malaria RDT', amount: 15 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.bill.total_amount).toBe(69);
    billId = res.body.bill.id;
  });

  it('retrieves the bill with its line items intact', async () => {
    const res = await request(app)
      .get(`/bills/${billId}`)
      .set('Authorization', `Bearer ${accountantToken}`);
    expect(res.status).toBe(200);
    expect(res.body.lineItems).toHaveLength(3);
    const sum = res.body.lineItems.reduce((s: number, i: { amount: string | number }) => s + Number(i.amount), 0);
    expect(sum).toBe(69);
  });
});
