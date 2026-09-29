import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/db/connection';
import * as authService from '../src/modules/auth/auth.service';

const app = createApp();

const testUsernames = [
  'phase5_dispense_tech',
  'phase5_dispense_clinician',
];

const medicineCode = 'P5-AMOXICILLIN';

describe('Dispensing workflow (integration, requires DB) - Step 5.2 gate', () => {
  let pharmacyTechToken: string;
  let pharmacyTechId: number;
  let clinicianId: number;
  let patientId: number;
  let prescriptionId: number;

  beforeAll(async () => {
    /*
     * Remove stale fixtures in foreign-key dependency order:
     * dispenses -> prescriptions -> patients/users.
     *
     * prescriptions.clinician_id references users.id with ON DELETE RESTRICT,
     * so the users cannot be deleted before their prescriptions.
     */
    const existingUsers = await db('users')
      .whereIn('username', testUsernames)
      .select('id');

    const existingUserIds = existingUsers
      .map((user) => user.id)
      .filter((id): id is number => typeof id === 'number');

    if (existingUserIds.length > 0) {
      const existingPrescriptions = await db('prescriptions')
        .whereIn('clinician_id', existingUserIds)
        .select('id');

      const existingPrescriptionIds = existingPrescriptions
        .map((prescription) => prescription.id)
        .filter((id): id is number => typeof id === 'number');

      if (existingPrescriptionIds.length > 0) {
        await db('dispenses')
          .whereIn('prescription_id', existingPrescriptionIds)
          .del();

        await db('prescriptions')
          .whereIn('id', existingPrescriptionIds)
          .del();
      }
    }

    await db('pharmacy_inventory')
      .where({ medicine_code: medicineCode })
      .del();

    await db('users').whereIn('username', testUsernames).del();

    const hash = await authService.hashPassword('Pass123!');

    const [tid] = await db('users').insert({
      username: 'phase5_dispense_tech',
      password_hash: hash,
      role: 'pharmacy_tech',
      is_active: true,
    });

    pharmacyTechId = tid;

    pharmacyTechToken = authService.issueTokenPair({
      id: tid,
      username: 'phase5_dispense_tech',
      role: 'pharmacy_tech',
    }).accessToken;

    const [cid] = await db('users').insert({
      username: 'phase5_dispense_clinician',
      password_hash: hash,
      role: 'clinician',
      is_active: true,
    });

    clinicianId = cid;

    const [pid] = await db('patients').insert({
      surname: 'Dispense',
      other_name: 'Case',
      gender: 'male',
    });

    patientId = pid;

    await db('pharmacy_inventory').insert({
      medicine_code: medicineCode,
      name: 'Amoxicillin 500mg',
      stock_qty: 20,
      reorder_level: 5,
      unit_cost: 0.2,
    });

    const [rxId] = await db('prescriptions').insert({
      patient_id: patientId,
      clinician_id: clinicianId,
      medicine_code: medicineCode,
      dosage: '500mg 3x daily',
      status: 'active',
      prescribed_date: '2026-08-14',
    });

    prescriptionId = rxId;
  });

  afterAll(async () => {
    try {
      if (prescriptionId) {
        await db('dispenses')
          .where({ prescription_id: prescriptionId })
          .del();

        await db('prescriptions')
          .where({ id: prescriptionId })
          .del();
      }

      if (patientId) {
        await db('patients')
          .where({ id: patientId })
          .del();
      }

      await db('pharmacy_inventory')
        .where({ medicine_code: medicineCode })
        .del();

      await db('users')
        .whereIn('username', testUsernames)
        .del();
    } finally {
      await db.destroy();
    }
  });

  it('dispenses against the active prescription and decrements stock', async () => {
    const res = await request(app)
      .post('/dispenses')
      .set('Authorization', `Bearer ${pharmacyTechToken}`)
      .send({
        prescriptionId,
        pharmacyTechId,
        quantity: 10,
      });

    expect(res.status).toBe(201);
    expect(res.body.quantity).toBe(10);

    const inventory = await db('pharmacy_inventory')
      .where({ medicine_code: medicineCode })
      .first();

    expect(inventory.stock_qty).toBe(10);

    const prescription = await db('prescriptions')
      .where({ id: prescriptionId })
      .first();

    expect(prescription.status).toBe('completed');
  });

  it('blocks dispensing again against the now-completed prescription', async () => {
    const res = await request(app)
      .post('/dispenses')
      .set('Authorization', `Bearer ${pharmacyTechToken}`)
      .send({
        prescriptionId,
        pharmacyTechId,
        quantity: 5,
      });

    expect(res.status).toBe(400);
  });
});