import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/db/connection';
import * as authService from '../src/modules/auth/auth.service';

const app = createApp();

describe('Pharmacy inventory (integration, requires DB) - Step 5.1 gate', () => {
  let pharmacyTechToken: string;

  beforeAll(async () => {
    await db('users').where({ username: 'phase5_pharm_tech' }).del();
    await db('pharmacy_inventory').whereIn('medicine_code', ['P5-IBUPROFEN', 'P5-LOWSTOCK']).del();

    const hash = await authService.hashPassword('Pass123!');
    const [id] = await db('users').insert({
      username: 'phase5_pharm_tech',
      password_hash: hash,
      role: 'pharmacy_tech',
      is_active: true,
    });
    pharmacyTechToken = authService.issueTokenPair({
      id,
      username: 'phase5_pharm_tech',
      role: 'pharmacy_tech',
    }).accessToken;
  });

  afterAll(async () => {
    await db('pharmacy_inventory').whereIn('medicine_code', ['P5-IBUPROFEN', 'P5-LOWSTOCK']).del();
    await db('users').where({ username: 'phase5_pharm_tech' }).del();
    await db.destroy();
  });

  it('creates an inventory item', async () => {
    const res = await request(app)
      .post('/pharmacy-inventory')
      .set('Authorization', `Bearer ${pharmacyTechToken}`)
      .send({ medicineCode: 'P5-IBUPROFEN', name: 'Ibuprofen 400mg', stockQty: 50, reorderLevel: 10, unitCost: 0.3 });
    expect(res.status).toBe(201);
  });

  it('flags an item at or below its reorder level', async () => {
    await request(app)
      .post('/pharmacy-inventory')
      .set('Authorization', `Bearer ${pharmacyTechToken}`)
      .send({ medicineCode: 'P5-LOWSTOCK', name: 'Low Stock Item', stockQty: 5, reorderLevel: 10, unitCost: 1 });

    const res = await request(app)
      .get('/pharmacy-inventory/low-stock')
      .set('Authorization', `Bearer ${pharmacyTechToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.map((i: { medicine_code: string }) => i.medicine_code)).toContain('P5-LOWSTOCK');
  });
});
